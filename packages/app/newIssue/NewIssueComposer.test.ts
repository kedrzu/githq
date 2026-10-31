/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import type { CreateIssueMutation, RepositoryMetadataQuery } from '@githq/github/generated.gen.js';
import type { IssueForm } from '@githq/github/issueForms/parseIssueForm.js';
import { createPromise } from '@nzyme/utils/createPromise.js';

import { AuthStore } from '@/auth/AuthStore.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { Browser } from '@/services/Browser.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { TestGraphQLAnswer, TestGraphQLRequest } from '@/testing/createTestSession.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { sampleIssueNode } from '@/testing/sampleRowNodes.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import type { IssueTemplate } from './IssueTemplateStore.js';
import type { NewIssueContext, NewIssueWaitingReason } from './NewIssueComposer.js';
import { NewIssueComposer } from './NewIssueComposer.js';

const IN_WEB: NewIssueContext = { repository: 'acme/web', project: null, parent: null };
const ANYWHERE: NewIssueContext = { repository: null, project: null, parent: null };

const DOCS_TEMPLATE: IssueTemplate = {
    kind: 'markdown',
    filename: 'docs.md',
    name: 'Documentation',
    about: 'Something in the docs is wrong',
    title: 'docs: ',
    body: '### What is wrong\n\n',
    labels: ['documentation'],
    assignees: [],
    type: null,
};

const BUG_FORM: IssueForm = {
    filename: 'bug_report.yml',
    name: 'Bug report',
    description: null,
    title: null,
    labels: ['bug'],
    assignees: [],
    type: null,
    fields: [
        {
            kind: 'textarea',
            label: 'What happened',
            description: null,
            required: true,
            placeholder: 'What happened?',
            value: null,
        },
    ],
};

test('closing keeps what was written; it is back after a reload, in its repository, and gone after sign-out', async () => {
    const { composer, browser, login } = await setup();

    composer.start(IN_WEB);
    composer.update({ title: 'Half a thought', body: 'and more' });
    composer.close();

    // A reload: the same browser storage, a new app.
    const reloaded = await setup({ login, storage: browser.localStorage.getItem(`githq.newIssue.${login}`) });
    reloaded.composer.start(ANYWHERE);
    expect(reloaded.composer.draft).toMatchObject({
        repository: 'acme/web',
        title: 'Half a thought',
        body: 'and more',
    });

    reloaded.session.container.resolve(AuthStore).signOut();
    expect(reloaded.browser.localStorage.getItem(`githq.newIssue.${login}`)).toBeNull();
});

test('create another keeps the capture open in the same repository with the title cleared; the next one starts there', async () => {
    const { composer } = await setup();

    composer.start(IN_WEB);
    composer.update({ title: 'First', labels: ['bug'] });
    await composer.submit(true);

    expect(composer.open).toBe(true);
    expect(composer.draft).toMatchObject({ repository: 'acme/web', title: '', labels: ['bug'] });

    composer.update({ title: 'Second' });
    await composer.submit(false);
    expect(composer.open).toBe(false);

    composer.start(ANYWHERE);
    expect(composer.draft).toMatchObject({ repository: 'acme/web', title: '', labels: [] });
});

test('H9: a creation GitHub refuses opens the capture again with everything as written and the reason', async () => {
    const { composer, github } = await setup();
    github.refuse = 'Repository was archived so is read-only.';

    composer.start(IN_WEB);
    composer.update({ title: 'Keep me', body: 'every word', labels: ['bug'] });
    await composer.submit(false);

    expect(composer.open).toBe(true);
    expect(composer.draft).toMatchObject({ title: 'Keep me', body: 'every word', labels: ['bug'] });
    expect(composer.rejection).toEqual({
        repository: 'acme/web',
        reason: { kind: 'refused', message: 'Repository was archived so is read-only.' },
    });
});

test('H9: two creations refused while another is written: both wait beside it, none overwrites it', async () => {
    const { composer, github, session } = await setup();
    github.refuse = 'Repository was archived so is read-only.';
    const held = createPromise();
    session.github.hold = held.promise;

    composer.start(IN_WEB);
    composer.update({ title: 'First', body: 'one' });
    const first = composer.submit(true);
    composer.update({ title: 'Second', body: 'two' });
    const second = composer.submit(true);
    composer.update({ title: 'Third, being written' });

    held.resolve();
    await Promise.all([first, second]);

    expect(composer.open).toBe(true);
    expect(composer.draft.title).toBe('Third, being written');
    const refused: NewIssueWaitingReason = {
        kind: 'refused',
        reason: { kind: 'refused', message: 'Repository was archived so is read-only.' },
    };
    expect(
        composer.waiting.map(entry => ({ title: entry.draft.title, body: entry.draft.body, why: entry.why })),
    ).toEqual([
        { title: 'First', body: 'one', why: refused },
        { title: 'Second', body: 'two', why: refused },
    ]);

    // Brought back, it takes the capture with its reason; what was written waits in its place.
    composer.restore(composer.waiting[1]?.id ?? 0);
    expect(composer.draft).toMatchObject({ title: 'Second', body: 'two' });
    expect(composer.rejection?.reason).toEqual({
        kind: 'refused',
        message: 'Repository was archived so is read-only.',
    });
    expect(composer.waiting.map(entry => [entry.draft.title, entry.why.kind])).toEqual([
        ['First', 'refused'],
        ['Third, being written', 'setAside'],
    ]);

    composer.discard(composer.waiting[0]?.id ?? 0);
    expect(composer.waiting.map(entry => entry.draft.title)).toEqual(['Third, being written']);
});

test('the text of a creation GitHub has not answered survives a reload, waiting to be checked', async () => {
    const { composer, browser, login, session } = await setup();
    session.github.hold = new Promise(() => {});

    composer.start(IN_WEB);
    composer.update({ title: 'On its way', body: 'every word' });
    void composer.submit(false);
    await session.clock.advance(0);

    const reloaded = await setup({ login, storage: browser.localStorage.getItem(`githq.newIssue.${login}`) });
    expect(reloaded.composer.waiting.map(entry => ({ draft: entry.draft, why: entry.why }))).toEqual([
        {
            draft: expect.objectContaining({ repository: 'acme/web', title: 'On its way', body: 'every word' }),
            why: { kind: 'unconfirmed' },
        },
    ]);
});

test('a created issue’s text is no longer kept', async () => {
    const { composer, browser, login } = await setup();

    composer.start(IN_WEB);
    composer.update({ title: 'Done', body: 'all of it' });
    await composer.submit(false);

    const reloaded = await setup({ login, storage: browser.localStorage.getItem(`githq.newIssue.${login}`) });
    expect(reloaded.composer.waiting).toEqual([]);
    reloaded.composer.start(IN_WEB);
    expect(reloaded.composer.draft).toMatchObject({ title: '', body: '' });
});

test('a draft is kept per repository: started in a repository, that repository wins with its own draft', async () => {
    const { composer, browser, login } = await setup();
    const parent = { id: 'I_api_3', reference: 'api#3' };

    composer.start(IN_WEB);
    composer.update({ title: 'Web thought' });
    composer.close();

    // Started from an issue of acme/api: there, offered as the parent — not in acme/web with an api parent.
    composer.start({ repository: 'acme/api', project: null, parent });
    expect(composer.draft).toMatchObject({ repository: 'acme/api', title: '', parent });
    composer.update({ title: 'Api thought' });
    composer.close();

    composer.start(IN_WEB);
    expect(composer.draft).toMatchObject({ repository: 'acme/web', title: 'Web thought', parent: null });
    composer.close();

    // Anywhere else: the draft shown last.
    composer.start(ANYWHERE);
    expect(composer.draft).toMatchObject({ repository: 'acme/web', title: 'Web thought' });
    composer.close();

    const reloaded = await setup({ login, storage: browser.localStorage.getItem(`githq.newIssue.${login}`) });
    reloaded.composer.start({ repository: 'acme/api', project: null, parent: null });
    expect(reloaded.composer.draft).toMatchObject({ repository: 'acme/api', title: 'Api thought' });
});

test('choosing another repository takes the text along without its parent; that repository’s draft waits', async () => {
    const { composer } = await setup();

    composer.start({ repository: 'acme/api', project: null, parent: null });
    composer.update({ title: 'Api thought' });
    composer.close();

    composer.start({ repository: 'acme/web', project: null, parent: { id: 'I_web_1', reference: 'web#1' } });
    composer.update({ title: 'Meant for api' });
    composer.update({ repository: 'acme/api' });

    expect(composer.draft).toMatchObject({ repository: 'acme/api', title: 'Meant for api', parent: null });
    expect(composer.waiting.map(entry => [entry.draft.title, entry.why.kind])).toEqual([['Api thought', 'setAside']]);
});

test('H7: a template chosen over written text goes below it, never in its place', async () => {
    const { composer } = await setup();

    composer.start(IN_WEB);
    composer.update({ title: 'Export drops the timezone', body: 'Seen on Safari.' });
    await composer.useTemplate(DOCS_TEMPLATE);

    expect(composer.draft).toMatchObject({
        title: 'Export drops the timezone',
        body: 'Seen on Safari.\n\n### What is wrong\n\n',
        labels: ['documentation'],
    });

    await composer.useTemplate({ kind: 'form', form: BUG_FORM });
    expect(composer.draft.body).toBe(
        'Seen on Safari.\n\n### What is wrong\n\n### What happened\n\n<!-- What happened? -->\n',
    );
    expect(composer.draft.form).toBe('bug_report.yml');
});

test('H7: a form where the user can’t push continues on GitHub; what was written stays in the capture', async () => {
    const { composer, session } = await setup();

    composer.start({ ...IN_WEB, repository: 'acme/oss' });
    composer.update({ title: 'Crash on start', body: 'Steps: open it.' });
    await composer.useTemplate({ kind: 'form', form: BUG_FORM });

    expect(session.openedTabs).toEqual([
        'https://github.com/acme/oss/issues/new?template=bug_report.yml&title=Crash+on+start',
    ]);
    expect(composer.draft).toMatchObject({ title: 'Crash on start', body: 'Steps: open it.', form: null });
    expect(composer.handoff).toEqual({ repository: 'acme/oss', form: 'Bug report' });
    expect(composer.open).toBe(true);

    // With nothing written below the title, everything went to GitHub: the capture closes, the title kept.
    composer.update({ body: '' });
    await composer.useTemplate({ kind: 'form', form: BUG_FORM });
    expect(composer.open).toBe(false);
    expect(composer.draft.title).toBe('Crash on start');
});

test('H7: a form picked before the repository’s permission is known waits for it before choosing how to go on', async () => {
    const { composer, session } = await setup();

    // acme/api was never read: the user can push there, which is known only once GitHub answers.
    composer.start({ ...IN_WEB, repository: 'acme/api' });
    await composer.useTemplate({ kind: 'form', form: BUG_FORM });

    expect(session.openedTabs).toEqual([]);
    expect(composer.draft).toMatchObject({ form: 'bug_report.yml', labels: ['bug'] });
});

interface FakeGitHub {
    /** GitHub refuses the creation with this message. */
    refuse: string | null;
}

interface SetupOptions {
    readonly login?: string;
    /** What the browser kept from before. */
    readonly storage?: string | null;
}

async function setup(options: SetupOptions = {}) {
    const login = options.login ?? `user-${crypto.randomUUID()}`;
    const github: FakeGitHub = { refuse: null };
    const session = createTestSession({ login, answer });
    setIndexedDbPersistence(session.container);
    const browser = session.container.resolve(Browser);
    if (options.storage) {
        browser.localStorage.setItem(`githq.newIssue.${login}`, options.storage);
    }

    const composer = session.container.resolve(NewIssueComposer);
    await session.container.resolve(ItemStore).ready();
    await session.container.resolve(RepositoryStore).ensure('acme/web');
    return { composer, browser, github, session, login };

    function answer(request: TestGraphQLRequest): TestGraphQLAnswer | undefined {
        switch (request.operation) {
            case 'RepositoryMetadata':
                return { data: metadata(`${String(request.variables.owner)}/${String(request.variables.name)}`) };
            case 'CreateIssue': {
                if (github.refuse !== null) {
                    return { data: { createIssue: null }, errors: [{ type: 'UNPROCESSABLE', message: github.refuse }] };
                }

                const node = sampleIssueNode('I_new', {
                    repository: 'acme/web',
                    number: 7,
                    updatedAt: '2026-10-30T13:00:00Z',
                });
                const data: CreateIssueMutation = {
                    createIssue: {
                        issue: {
                            ...node,
                            labels: { nodes: [{ name: 'bug', color: 'd73a4a' }] },
                            parent: null,
                        },
                    },
                };
                return { data };
            }
            default:
                return undefined;
        }
    }
}

/** acme/oss: the user can't push there. */
function metadata(nameWithOwner: string): RepositoryMetadataQuery {
    return {
        repository: {
            id: `R_${nameWithOwner}`,
            nameWithOwner,
            viewerPermission: nameWithOwner === 'acme/oss' ? 'READ' : 'WRITE',
            isArchived: false,
            hasIssuesEnabled: true,
            labels: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [{ id: 'LA_bug', name: 'bug', color: 'd73a4a', description: null }],
            },
            milestones: { totalCount: 0, nodes: [] },
            assignableUsers: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
            issueTypes: { nodes: [] },
        },
    };
}
