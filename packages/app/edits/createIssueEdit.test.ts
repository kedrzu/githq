/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import type { CreateIssueMutation, RepositoryMetadataQuery } from '@githq/github/generated.gen.js';
import { createPromise } from '@nzyme/utils/createPromise.js';

import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { ItemOverlay } from '@/store/ItemOverlay.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { TestGraphQLAnswer, TestGraphQLRequest } from '@/testing/createTestSession.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { sampleIssueNode } from '@/testing/sampleRowNodes.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import type { NewIssueInput } from './createIssueEdit.js';
import { EditQueue } from './EditQueue.js';
import { ItemEditor } from './ItemEditor.js';

const CREATED = '2026-10-30T13:00:00Z';

test('a new issue shows at once — in "my work" when assigned to the user — and GitHub’s issue takes its place', async () => {
    const { editor, items, overlay, github, session, login } = await setup();
    const held = createPromise();
    session.github.hold = held.promise;

    const done = editor.createIssue({
        repository: 'acme/web',
        issue: input({ labels: ['bug'], assignees: [login] }),
        projects: [],
    });
    await session.clock.advance(0);

    const pending = items.all.find(item => item.title === 'Reminders skip DST');
    expect(pending).toMatchObject({ number: 0, labels: [{ name: 'bug' }], assignees: [{ login }] });
    expect(items.membership.assigned?.has(pending?.id ?? '')).toBe(true);

    held.resolve();
    expect(await done).toEqual({ created: true, failed: [] });

    expect(items.getStored('I_new')).toMatchObject({ number: 42, labels: [{ name: 'bug' }] });
    expect(items.all.filter(item => item.title === 'Reminders skip DST').map(item => item.id)).toEqual(['I_new']);
    expect(items.membership.assigned?.has('I_new')).toBe(true);
    expect(overlay.getConfirmedId(pending?.id ?? '')).toBe('I_new');
    expect(github.created()).toEqual([
        expect.objectContaining({
            repositoryId: 'R_web',
            title: 'Reminders skip DST',
            labelIds: ['LA_bug'],
            assigneeIds: [`U_${login}`],
        }),
    ]);
});

test('what GitHub silently drops (no push access) is reported, not shown as set (D14)', async () => {
    const { editor, items, queue, github } = await setup();
    github.dropValues = true;

    const outcome = await editor.createIssue({
        repository: 'acme/web',
        issue: input({ labels: ['bug'] }),
        projects: [],
    });

    expect(outcome.created).toBe(true);
    expect(
        outcome.failed.map(({ edit, reason }) => ({ subject: edit.subject, reference: edit.reference, reason })),
    ).toEqual([
        { subject: { kind: 'labelAdded', label: 'bug' }, reference: 'acme/web#42', reason: { kind: 'dropped' } },
    ]);
    expect(items.get('I_new')?.labels).toEqual([]);
    expect(queue.failures).toHaveLength(1);
});

test('values the repository does not have are never sent and reported as not in it, the rest created', async () => {
    const { editor, items, github, session } = await setup();

    const outcome = await editor.createIssue({
        repository: 'acme/web',
        issue: input({ labels: ['bug', 'needs-design'], assignees: ['ghost'], milestone: 'v9', issueType: 'Epic' }),
        projects: [],
    });

    expect(outcome.created).toBe(true);
    expect(
        outcome.failed.map(({ edit, reason }) => ({ subject: edit.subject, reference: edit.reference, reason })),
    ).toEqual([
        {
            subject: { kind: 'labelAdded', label: 'needs-design' },
            reference: 'acme/web#42',
            reason: { kind: 'missing' },
        },
        { subject: { kind: 'assigneeAdded', login: 'ghost' }, reference: 'acme/web#42', reason: { kind: 'missing' } },
        { subject: { kind: 'milestone', title: 'v9' }, reference: 'acme/web#42', reason: { kind: 'missing' } },
        { subject: { kind: 'issueType', name: 'Epic' }, reference: 'acme/web#42', reason: { kind: 'missing' } },
    ]);
    // Looked up by name before being left out.
    expect(session.operations()).toEqual(expect.arrayContaining(['RepositoryLabel', 'UserByLogin']));
    expect(github.created()).toEqual([expect.objectContaining({ labelIds: ['LA_bug'], assigneeIds: [] })]);
    expect(items.get('I_new')?.labels.map(label => label.name)).toEqual(['bug']);
});

test('a creation GitHub refuses takes the issue away and says why', async () => {
    const { editor, items, github } = await setup();
    github.refuse = 'Repository was archived so is read-only.';

    const outcome = await editor.createIssue({ repository: 'acme/web', issue: input({}), projects: [] });

    expect(outcome.created).toBe(false);
    expect(outcome.failed.map(failed => failed.reason)).toEqual([
        { kind: 'refused', message: 'Repository was archived so is read-only.' },
    ]);
    expect(items.all.some(item => item.title === 'Reminders skip DST')).toBe(false);
});

test('an edit asked of an issue still being created waits for it and is made of GitHub’s issue, never the temporary id', async () => {
    const { editor, items, github, session } = await setup();
    const held = createPromise();
    session.github.hold = held.promise;

    const creating = editor.createIssue({ repository: 'acme/web', issue: input({}), projects: [] });
    await session.clock.advance(0);
    const pending = items.all.find(item => item.title === 'Reminders skip DST');
    expect(pending?.number).toBe(0);

    const closing = editor.edit([pending?.id ?? ''], { kind: 'close', reason: 'COMPLETED' });
    held.resolve();

    expect(await creating).toEqual({ created: true, failed: [] });
    expect(await closing).toEqual({ failed: [] });
    expect(github.closed()).toEqual([{ issueId: 'I_new', stateReason: 'COMPLETED' }]);
    expect(items.get('I_new')?.state).toBe('CLOSED');
});

test('an edit asked of an issue GitHub then refuses to create is not sent', async () => {
    const { editor, items, github, session } = await setup();
    github.refuse = 'Repository was archived so is read-only.';
    const held = createPromise();
    session.github.hold = held.promise;

    const creating = editor.createIssue({ repository: 'acme/web', issue: input({}), projects: [] });
    await session.clock.advance(0);
    const pending = items.all.find(item => item.title === 'Reminders skip DST');

    const closing = editor.edit([pending?.id ?? ''], { kind: 'close', reason: 'COMPLETED' });
    held.resolve();

    expect((await creating).created).toBe(false);
    expect(await closing).toEqual({ failed: [] });
    expect(github.closed()).toEqual([]);
});

interface FakeGitHub {
    dropValues: boolean;
    refuse: string | null;
    created(): readonly Readonly<Record<string, unknown>>[];
    closed(): readonly Readonly<Record<string, unknown>>[];
}

async function setup() {
    const login = `user-${crypto.randomUUID()}`;
    const github: FakeGitHub = {
        dropValues: false,
        refuse: null,
        created: () =>
            session.github.requests
                .filter(request => request.operation === 'CreateIssue')
                .map(request => request.variables),
        closed: () =>
            session.github.requests
                .filter(request => request.operation === 'CloseIssue')
                .map(request => request.variables),
    };
    const session = createTestSession({ login, answer });
    setIndexedDbPersistence(session.container);
    const items = session.container.resolve(ItemStore);
    const editor = session.container.resolve(ItemEditor);
    const queue = session.container.resolve(EditQueue);
    const overlay = session.container.resolve(ItemOverlay);
    await items.ready();
    items.setMembership('assigned', []);
    await session.container.resolve(RepositoryStore).ensure('acme/web');

    return { editor, items, queue, overlay, github, session, login };

    function answer(request: TestGraphQLRequest): TestGraphQLAnswer | undefined {
        switch (request.operation) {
            case 'RepositoryMetadata':
                return { data: metadata(login) };
            case 'CreateIssue': {
                if (github.refuse !== null) {
                    return { data: { createIssue: null }, errors: [{ type: 'UNPROCESSABLE', message: github.refuse }] };
                }

                const keep = !github.dropValues;
                const { labelIds, assigneeIds, title } = request.variables;
                const node = sampleIssueNode('I_new', { repository: 'acme/web', number: 42, updatedAt: CREATED });
                const data: CreateIssueMutation = {
                    createIssue: {
                        issue: {
                            ...node,
                            title: String(title),
                            labels: {
                                nodes:
                                    keep && Array.isArray(labelIds) && labelIds.length > 0
                                        ? [{ name: 'bug', color: 'd73a4a' }]
                                        : [],
                            },
                            assignees: {
                                nodes:
                                    keep && Array.isArray(assigneeIds) && assigneeIds.length > 0
                                        ? [{ login, avatarUrl: `https://avatars.test/${login}` }]
                                        : [],
                            },
                            parent: null,
                        },
                    },
                };
                return { data };
            }
            case 'RepositoryLabel':
                return { data: { repository: { label: null } } };
            case 'UserByLogin':
                return { data: { user: null } };
            case 'CloseIssue': {
                const issue = {
                    id: request.variables.issueId,
                    updatedAt: CREATED,
                    state: 'CLOSED',
                    stateReason: request.variables.stateReason,
                    closedAt: CREATED,
                };
                return { data: { closeIssue: { issue } } };
            }
            default:
                return undefined;
        }
    }
}

function input(values: Partial<NewIssueInput>): NewIssueInput {
    return {
        title: 'Reminders skip DST',
        body: '',
        assignees: [],
        labels: [],
        milestone: null,
        issueType: null,
        parent: null,
        ...values,
    };
}

function metadata(login: string): RepositoryMetadataQuery {
    return {
        repository: {
            id: 'R_web',
            nameWithOwner: 'acme/web',
            viewerPermission: 'WRITE',
            isArchived: false,
            hasIssuesEnabled: true,
            labels: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [{ id: 'LA_bug', name: 'bug', color: 'd73a4a', description: null }],
            },
            milestones: { totalCount: 0, nodes: [] },
            assignableUsers: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [{ id: `U_${login}`, login, name: null, avatarUrl: `https://avatars.test/${login}` }],
            },
            issueTypes: { nodes: [] },
        },
    };
}
