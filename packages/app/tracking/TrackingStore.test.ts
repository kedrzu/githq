/// <reference types="bun" />
// IndexedDB for bun; every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';
import { deleteDB } from 'idb';

import { getLocalDatabaseName } from '@/store/IndexedDbPersistence.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { SettingsDocument } from '@/settings/sync/SettingsDocument.js';
import { createTestSession } from '@/testing/createTestSession.js';
import type { TestGraphQLAnswer, TestGraphQLRequest } from '@/testing/createTestSession.js';
import { createTestTabs } from '@/testing/createTestTabs.js';
import type { TestTabs } from '@/testing/createTestTabs.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { TrackingStore } from './TrackingStore.js';
import type { TrackedProject, TrackedRepository, TrackedTarget } from './TrackingTypes.js';

const WEB: TrackedRepository = { nameWithOwner: 'acme/web', id: 'R_web' };
const API: TrackedRepository = { nameWithOwner: 'acme/api', id: 'R_api' };
const DOCS: TrackedRepository = { nameWithOwner: 'acme/docs', id: 'R_docs' };
const ROADMAP: TrackedProject = { id: 'PVT_1', owner: 'acme', ownerKind: 'org', number: 1, title: 'Roadmap' };

test('the choice is kept in localStorage in the file’s shape: untracking keeps the entry, tracking again returns it to its place', async () => {
    const { tracking, localStorage, login } = await open();
    tracking.choose({ repositories: [WEB, API, DOCS], projects: [ROADMAP] });

    tracking.untrack({ kind: 'repository', nameWithOwner: 'acme/api' });
    tracking.untrack({ kind: 'project', id: 'PVT_1' });
    expect(tracking.repositories).toEqual([WEB, DOCS]);
    expect(tracking.projects).toEqual([]);
    expect(tracking.document).toEqual({
        version: 1,
        repositories: [
            { ...WEB, tracking: true },
            { ...API, tracking: false },
            { ...DOCS, tracking: true },
        ],
        projects: [{ ...ROADMAP, tracking: false }],
    });

    tracking.track({ repository: API });
    tracking.track({ repository: { nameWithOwner: 'acme/new', id: 'R_new' } });
    expect(tracking.repositories.map(repository => repository.nameWithOwner)).toEqual([
        'acme/web',
        'acme/api',
        'acme/docs',
        'acme/new',
    ]);
    expect(JSON.parse(localStorage.get(`githq.settings.${login}`) ?? 'null')).toEqual({
        chosen: true,
        document: tracking.document,
        saving: { state: 'off' },
    });
});

test('untracking drops the sync state and the copy, also when the document is replaced; a new entry is tracked', async () => {
    const { tracking } = await open();
    const untracked: TrackedTarget[] = [];
    tracking.onUntrack(target => untracked.push(target));
    tracking.choose({ repositories: [WEB, API], projects: [ROADMAP] });
    await tracking.updateSyncState({ kind: 'repository', nameWithOwner: 'acme/web' }, { phase: 'done' });

    tracking.untrack({ kind: 'repository', nameWithOwner: 'acme/web' });
    expect(untracked).toEqual([{ kind: 'repository', nameWithOwner: 'acme/web' }]);
    expect(tracking.getSyncState({ kind: 'repository', nameWithOwner: 'acme/web' })).toBeUndefined();

    // The settings repository's document: api untracked, docs new, web tracked again, in the file's order.
    const document: SettingsDocument = {
        version: 1,
        repositories: [
            { ...DOCS, tracking: true },
            { ...API, tracking: false },
            { ...WEB, tracking: true },
        ],
        projects: [{ ...ROADMAP, tracking: true }],
    };
    tracking.replaceDocument(document);
    expect(untracked).toEqual([
        { kind: 'repository', nameWithOwner: 'acme/web' },
        { kind: 'repository', nameWithOwner: 'acme/api' },
    ]);
    expect(tracking.document).toEqual(document);
    expect(tracking.repositories).toEqual([DOCS, WEB]);
    expect(tracking.chosen).toBe(true);
});

test('the choice survives a new cache database, in its order', async () => {
    const login = `user-${crypto.randomUUID()}`;
    const first = await open({ login });
    first.tracking.choose({ repositories: [API, WEB], projects: [ROADMAP] });

    await deleteDB(getLocalDatabaseName(login));
    const second = await open({ login, localStorage: first.localStorage });
    expect(second.tracking.chosen).toBe(true);
    expect(second.tracking.repositories).toEqual([API, WEB]);
    expect(second.tracking.projects).toEqual([ROADMAP]);
});

test('a sync state left by an untrack the closing page cut off goes when the settings are read, so tracking it again downloads it', async () => {
    const login = `user-${crypto.randomUUID()}`;
    const target = { kind: 'repository', nameWithOwner: 'acme/web' } as const;
    const stillTracked = { kind: 'repository', nameWithOwner: 'acme/api' } as const;
    const first = await open({ login });
    first.tracking.choose({ repositories: [WEB, API], projects: [] });
    await first.tracking.updateSyncState(target, { phase: 'done' });
    await first.tracking.updateSyncState(stillTracked, { phase: 'done' });
    // Untracked in the slot, written at once; the sync state's delete never reached the local copy.
    const kept = JSON.parse(first.localStorage.get(`githq.settings.${login}`) ?? 'null') as {
        document: SettingsDocument;
    };
    first.localStorage.set(
        `githq.settings.${login}`,
        JSON.stringify({
            ...kept,
            document: {
                ...kept.document,
                repositories: kept.document.repositories.map(entry =>
                    entry.nameWithOwner === WEB.nameWithOwner ? { ...entry, tracking: false } : entry,
                ),
            },
        }),
    );

    const second = await open({ login, localStorage: first.localStorage });
    expect(second.tracking.getSyncState(target)).toBeUndefined();
    expect(second.tracking.getSyncState(stillTracked)?.phase).toBe('done');
    second.tracking.track({ repository: WEB });

    // Gone from the local copy too, not only from this tab's memory.
    const third = await open({ login, localStorage: first.localStorage });
    expect(third.tracking.isTracked(target)).toBe(true);
    expect(third.tracking.getSyncState(target)).toBeUndefined();
});

test('a slot this build does not understand is left as it is until the user changes something here', async () => {
    const login = `user-${crypto.randomUUID()}`;
    const key = `githq.settings.${login}`;
    const newer = JSON.stringify({ chosen: true, document: { version: 2, repositories: [], projects: [] } });
    const localStorage = new Map([[key, newer]]);

    const { tracking } = await open({ login, localStorage });
    expect(tracking.chosen).toBe(false);
    expect(tracking.repositories).toEqual([]);
    expect(localStorage.get(key)).toBe(newer);

    // A change the user makes here is kept.
    tracking.choose({ repositories: [API], projects: [] });
    expect(JSON.parse(localStorage.get(key) ?? 'null')).toMatchObject({ chosen: true, document: { version: 1 } });
});

test('a tab that has not heard of another tab’s change yet writes on top of it: the slot they share is the truth', async () => {
    const login = `user-${crypto.randomUUID()}`;
    const key = `githq.settings.${login}`;
    // One localStorage, no broadcast between them: the second tab never hears what the first one sends.
    const first = await open({ login });
    const second = await open({ login, localStorage: first.localStorage });
    first.tracking.choose({ repositories: [WEB], projects: [] });

    second.tracking.track({ repository: API });
    expect(second.tracking.repositories).toEqual([WEB, API]);
    expect(JSON.parse(first.localStorage.get(key) ?? 'null')).toMatchObject({
        document: {
            repositories: [
                { ...WEB, tracking: true },
                { ...API, tracking: true },
            ],
        },
    });

    first.tracking.untrack({ kind: 'repository', nameWithOwner: 'acme/api' });
    first.tracking.saveSaving({ state: 'stopped', reason: { kind: 'deleted' } });
    // The second tab saves its saving state onto the document the first one left.
    second.tracking.saveSaving({ state: 'off', repositoryLeft: true });
    expect(JSON.parse(first.localStorage.get(key) ?? 'null')).toEqual({
        chosen: true,
        document: {
            version: 1,
            repositories: [
                { ...WEB, tracking: true },
                { ...API, tracking: false },
            ],
            projects: [],
        },
        saving: { state: 'off', repositoryLeft: true },
    });
    expect(second.tracking.repositories).toEqual([WEB]);

    // And replacing the document keeps the saving state the first tab left.
    first.tracking.saveSaving({ state: 'stopped', reason: { kind: 'deleted' } });
    second.tracking.replaceDocument({ version: 1, repositories: [{ ...DOCS, tracking: true }], projects: [] });
    expect(JSON.parse(first.localStorage.get(key) ?? 'null')).toMatchObject({
        saving: { state: 'stopped', reason: { kind: 'deleted' } },
    });
});

test('a choice made as a change of what is tracked is made of what the shared slot holds, another tab’s change included', async () => {
    const login = `user-${crypto.randomUUID()}`;
    // One localStorage, no broadcast between them: the second tab never hears what the first one sends.
    const first = await open({ login });
    const second = await open({ login, localStorage: first.localStorage });
    second.tracking.choose({ repositories: [WEB, API], projects: [] });
    const untracked: TrackedTarget[] = [];
    second.tracking.onUntrack(target => untracked.push(target));

    first.tracking.track({ repository: DOCS });
    second.tracking.choose(({ repositories, projects }) => ({
        repositories: repositories.filter(repository => repository.nameWithOwner !== 'acme/api'),
        projects: [...projects, ROADMAP],
    }));

    expect(second.tracking.repositories).toEqual([WEB, DOCS]);
    expect(second.tracking.projects).toEqual([ROADMAP]);
    // Only what the change untracked is dropped here.
    expect(untracked).toEqual([{ kind: 'repository', nameWithOwner: 'acme/api' }]);
});

test('settings loaded instead of choosing count as the choice, what they track kept as it is', async () => {
    const { tracking, localStorage, login } = await open();
    const loaded: SettingsDocument = { version: 1, repositories: [{ ...API, tracking: true }], projects: [] };
    tracking.replaceDocument(loaded);
    expect(tracking.chosen).toBe(false);

    tracking.markChosen();
    expect(tracking.chosen).toBe(true);
    expect(tracking.document).toEqual(loaded);
    expect(JSON.parse(localStorage.get(`githq.settings.${login}`) ?? 'null')).toMatchObject({
        chosen: true,
        document: loaded,
    });
});

test('signing out deletes the kept choice', async () => {
    const { tracking, session, localStorage, login } = await open();
    tracking.choose({ repositories: [WEB], projects: [] });
    expect(localStorage.has(`githq.settings.${login}`)).toBe(true);

    session.signOutFromAnotherTab();
    expect(localStorage.has(`githq.settings.${login}`)).toBe(false);
    expect(tracking.chosen).toBe(false);

    session.signInFromAnotherTab(login);
    await tracking.ready();
    expect(tracking.chosen).toBe(false);
    expect(tracking.repositories).toEqual([]);
});

test('tabs stay in step: another tab takes the change in, and the document it saved when they share localStorage', async () => {
    const login = `user-${crypto.randomUUID()}`;
    const tabs = createTestTabs();
    const first = await open({ login, tabs });
    const second = await open({ login, tabs });

    first.tracking.choose({ repositories: [WEB, API], projects: [ROADMAP] });
    first.tracking.untrack({ kind: 'repository', nameWithOwner: 'acme/web' });
    await first.session.clock.advance(0);
    expect(second.tracking.chosen).toBe(true);
    expect(second.tracking.repositories).toEqual([API]);
    expect(second.tracking.document).toEqual(first.tracking.document);

    // A reorder no tracking message can say: read from the slot the tabs share.
    first.tracking.replaceDocument({
        version: 1,
        repositories: [
            { ...API, tracking: true },
            { ...WEB, tracking: true },
        ],
        projects: [{ ...ROADMAP, tracking: true }],
    });
    const key = `githq.settings.${login}`;
    second.localStorage.set(key, first.localStorage.get(key) ?? '');
    await first.session.clock.advance(0);
    expect(second.tracking.document).toEqual(first.tracking.document);
    expect(second.tracking.repositories).toEqual([API, WEB]);
});

test('a repository’s workflows setting is written only when the user changes it, kept through untracking, told as a local change and taken in by another tab', async () => {
    const login = `user-${crypto.randomUUID()}`;
    const tabs = createTestTabs();
    const first = await open({ login, tabs });
    const second = await open({ login, tabs });
    let changes = 0;
    first.tracking.onLocalChange(() => changes++);
    first.tracking.choose({ repositories: [WEB, API], projects: [] });
    changes = 0;

    // Nobody set it: the entries carry none.
    expect(first.tracking.document.repositories).toEqual([
        { ...WEB, tracking: true },
        { ...API, tracking: true },
    ]);

    const settings = { defaultBranch: false, refs: ['v*'] };
    first.tracking.setWorkflowSettings('acme/web', settings);
    first.tracking.setWorkflowSettings('acme/web', settings);
    first.tracking.setWorkflowSettings('acme/unknown', settings);
    expect(changes).toBe(1);
    expect(first.tracking.document.repositories[0]).toEqual({ ...WEB, tracking: true, workflows: settings });

    first.tracking.untrack({ kind: 'repository', nameWithOwner: 'acme/web' });
    first.tracking.track({ repository: WEB });
    expect(first.tracking.document.repositories[0]).toEqual({ ...WEB, tracking: true, workflows: settings });

    const key = `githq.settings.${login}`;
    second.localStorage.set(key, first.localStorage.get(key) ?? '');
    await first.session.clock.advance(0);
    expect(second.tracking.document).toEqual(first.tracking.document);
});

test('the user’s settings repository is never offered to track; someone else’s of that name is', async () => {
    const login = `user-${crypto.randomUUID()}`;
    const { tracking } = await open({
        login,
        answer: request => {
            switch (request.operation) {
                case 'TrackingCandidates':
                    return {
                        data: {
                            viewer: {
                                login,
                                repositories: pageOf([`${login.toUpperCase()}/GitHQ-Settings`, `${login}/app`]),
                                organizations: {
                                    nodes: [
                                        { login: 'acme', avatarUrl: '', repositories: pageOf(['acme/githq-settings']) },
                                    ],
                                },
                            },
                        },
                    };
                case 'TrackingProjects':
                    return {
                        data: { viewer: { projectsV2: { totalCount: 0, nodes: [] }, organizations: { nodes: [] } } },
                    };
                case 'RepositoryForTracking':
                    return {
                        data: { repository: repositoryNode(`${String(request.variables.owner)}/githq-settings`) },
                    };
                default:
                    return undefined;
            }
        },
    });

    const candidates = await tracking.loadCandidates();
    expect(candidates?.repositories).toMatchObject({
        totalCount: 1,
        repositories: [{ nameWithOwner: `${login}/app` }],
    });
    expect(candidates?.organizations[0]?.repositories?.repositories).toMatchObject([
        { nameWithOwner: 'acme/githq-settings' },
    ]);

    expect(await tracking.findCandidate({ kind: 'repository', owner: login, name: 'githq-settings' })).toBeNull();
    expect(await tracking.findCandidate({ kind: 'repository', owner: 'acme', name: 'githq-settings' })).toMatchObject({
        nameWithOwner: 'acme/githq-settings',
    });
});

interface OpenOptions {
    readonly login?: string;
    readonly localStorage?: Map<string, string>;
    readonly tabs?: TestTabs;
    readonly answer?: (request: TestGraphQLRequest) => TestGraphQLAnswer | undefined;
}

/** A tab signed in with its local copy open and the kept choice read. */
async function open(options: OpenOptions = {}) {
    const login = options.login ?? `user-${crypto.randomUUID()}`;
    const session = createTestSession({
        login,
        answer: options.answer ?? (() => undefined),
        localStorage: options.localStorage,
        tabs: options.tabs,
    });
    setIndexedDbPersistence(session.container);
    session.container.resolve(ItemStore);
    const tracking = session.container.resolve(TrackingStore);
    await tracking.ready();
    return { session, tracking, login, localStorage: session.localStorage };
}

function pageOf(names: readonly string[]) {
    return {
        totalCount: names.length,
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: names.map(repositoryNode),
    };
}

function repositoryNode(nameWithOwner: string) {
    return {
        id: `R_${nameWithOwner}`,
        nameWithOwner,
        isPrivate: true,
        isArchived: false,
        pushedAt: '2026-11-01T00:00:00Z',
        viewerPermission: 'ADMIN',
        owner: { login: nameWithOwner.split('/')[0] },
        issues: { totalCount: 0 },
        pullRequests: { totalCount: 0 },
    };
}
