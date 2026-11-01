/// <reference types="bun" />
// IndexedDB for bun; every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import { createPromise } from '@nzyme/utils/createPromise.js';

import { AuthStore } from '@/auth/AuthStore.js';
import { ProjectStore } from '@/projects/ProjectStore.js';
import { createIndexedDbPersistence } from '@/store/IndexedDbPersistence.js';
import type { IndexedDbPersistence } from '@/store/IndexedDbPersistence.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { TestGraphQLRequest } from '@/testing/createTestSession.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { createTrackingWorld, worldProjectItem } from '@/testing/createTrackingWorld.js';
import type { TrackingWorld } from '@/testing/createTrackingWorld.js';
import { sampleIssueNode, samplePullRequestNode } from '@/testing/sampleRowNodes.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import type { TrackingChoice } from '@/tracking/TrackingStore.js';
import type { TrackingProgress } from '@/tracking/TrackingTypes.js';

import { SyncEngine } from './SyncEngine.js';

const MONDAY = '2026-10-26T10:00:00Z';
const FRIDAY = '2026-10-30T13:20:00Z';

const TRACK_ALL: TrackingChoice = {
    repositories: [
        { nameWithOwner: 'acme/web', id: 'R_web' },
        { nameWithOwner: 'acme/api', id: 'R_api' },
    ],
    projects: [{ id: 'PVT_1', owner: 'acme', ownerKind: 'org', number: 1, title: 'Roadmap' }],
};

test('the first download: my work first, then the open items of every repository, then the projects, closed items last', async () => {
    const world = sampleWorld();
    // "My work" has not arrived yet: GitHub's search fails.
    world.failing.add('search null');
    const { session, tracking, items, projects } = await setup(world);

    // Chosen on the tracking screen meanwhile: nothing is downloaded before "my work" is in.
    tracking.choose(TRACK_ALL);
    await session.clock.advance(0);
    expect(downloads(session.github.requests).filter(read => !read.startsWith('search'))).toEqual([]);

    world.failing.clear();
    session.github.requests.length = 0;
    await session.clock.advance(30_000);
    expect(downloads(session.github.requests)).toEqual([
        'search is:open is:pr review-requested:@me archived:false',
        'search is:open is:pr author:@me archived:false',
        'search is:open is:issue assignee:@me archived:false',
        'search is:open mentions:@me archived:false',
        'RepositoryIssues acme/web OPEN',
        'RepositoryIssues acme/web OPEN after 2',
        'RepositoryPullRequests acme/web OPEN',
        'RepositoryIssues acme/api OPEN',
        'RepositoryPullRequests acme/api OPEN',
        'ProjectFull PVT_1',
        'ProjectItems PVT_1 after 2',
        'RepositoryIssues acme/web CLOSED',
        'RepositoryPullRequests acme/web CLOSED,MERGED',
        'RepositoryIssues acme/api CLOSED',
        'RepositoryPullRequests acme/api CLOSED,MERGED',
    ]);
    // Pull requests come 30 to a page: 100 with their status time out on big repositories.
    const firsts = session.github.requests
        .filter(request => request.operation === 'RepositoryPullRequests')
        .map(request => request.variables.first);
    expect(new Set(firsts)).toEqual(new Set([30]));

    const expected: TrackingProgress = { state: 'done', done: 6, total: 6 };
    expect(tracking.getProgress({ kind: 'repository', nameWithOwner: 'acme/web' })).toEqual(expected);
    expect(items.get('I_web_closed')?.state).toBe('CLOSED');
    expect(items.get('PR_web_merged')?.state).toBe('MERGED');
    // The project's items: its issues as rows in the item store, a draft and the values in the project.
    expect(projects.getItems('PVT_1').map(item => [item.itemId, item.contentId, item.values.F_status?.kind])).toEqual([
        ['PVTI_1', 'I_web_1', 'singleSelect'],
        ['PVTI_2', 'I_lib', undefined],
        ['PVTI_3', 'I_other', 'singleSelect'],
    ]);
    expect(items.get('I_lib')?.repository.nameWithOwner).toBe('other/lib');
    expect(projects.getRowField('PVT_1')?.name).toBe('Status');
});

test('a download stopped halfway — a tab closed — goes on in the next session from the page it reached', async () => {
    const world = sampleWorld();
    const login = uniqueLogin();
    const persistence = createIndexedDbPersistence();
    // The second page of acme/web's open issues never comes in the first tab.
    world.failing.add('RepositoryIssues 2');
    const first = await setup(world, { login, persistence });
    first.tracking.choose(TRACK_ALL);
    await first.session.clock.advance(0);
    expect(first.items.get('I_web_1')).toBeDefined();

    world.failing.clear();
    const second = await setup(world, {
        login,
        persistence: createIndexedDbPersistence(),
        localStorage: first.session.localStorage,
    });
    await second.session.clock.advance(0);

    // What the first tab read is on disk; the second reads on from where it stopped, not from the start.
    const issuePages = second.session.github.requests.filter(
        request => request.operation === 'RepositoryIssues' && request.variables.owner === 'acme',
    );
    expect(issuePages.map(request => `${String(request.variables.name)} ${String(request.variables.after)}`)).toEqual([
        'web 2',
        'api null',
        'web null',
        'api null',
    ]);
    expect(second.items.get('I_web_1')?.title).toBe('Issue I_web_1');
    expect(second.tracking.getProgress({ kind: 'repository', nameWithOwner: 'acme/web' }).state).toBe('done');
});

test('while nothing changes the polls cost nothing; a change is read again alone', async () => {
    const world = sampleWorld();
    const { session, tracking, items, projects } = await setup(world);
    tracking.choose(TRACK_ALL);
    await session.clock.advance(0);

    // Settled: the polls answered 304, so nothing is read through GraphQL.
    session.github.requests.length = 0;
    await session.clock.advance(60_000);
    expect(restPolls(session.github.requests)).toEqual([
        'GET /repos/acme/web/issues conditional',
        'GET /repos/acme/api/issues conditional',
        'GET /orgs/acme/projectsV2/1 conditional',
    ]);
    expect(graphql(session.github.requests)).toEqual([]);

    // An issue edited, and a project field changed (the issue lists do not see that one).
    world.items.set('I_web_2', { ...nodeOf(world, 'I_web_2'), title: 'Renamed', updatedAt: FRIDAY });
    world.project.items = world.project.items.map(item =>
        item.id === 'PVTI_3'
            ? { ...worldProjectItem('PVTI_3', nodeOf(world, 'I_other'), 'O_done'), updatedAt: FRIDAY }
            : item,
    );
    world.project.etag = '"p2"';
    session.github.requests.length = 0;
    await session.clock.advance(60_000);

    expect(graphql(session.github.requests)).toEqual([
        'ItemsByIds I_web_2',
        'ProjectSchema PVT_1',
        // The day before the last read: the filter has date granularity.
        'ProjectItems PVT_1 updated:>=2026-10-29',
    ]);
    // 20 to a page: GitHub charges for the items asked, and a change touches a few.
    const reread = session.github.requests.find(request => request.operation === 'ProjectItems');
    expect(reread?.variables.first).toBe(20);
    expect(items.get('I_web_2')?.title).toBe('Renamed');
    expect(projects.getStoredItem('PVTI_3')?.values.F_status).toMatchObject({ name: 'Done' });

    // An item removed from the project, which the narrowed read cannot see: the count tells, all are read again.
    world.project.items = world.project.items.filter(item => item.id !== 'PVTI_2');
    world.project.etag = '"p3"';
    session.github.requests.length = 0;
    await session.clock.advance(60_000);

    expect(graphql(session.github.requests)).toEqual([
        'ProjectSchema PVT_1',
        'ProjectItems PVT_1 updated:>=2026-10-29',
        'ProjectItems PVT_1',
    ]);
    expect(projects.getStoredItems('PVT_1').map(item => item.itemId)).toEqual(['PVTI_1', 'PVTI_3']);
    // Its issue is in nothing tracked and not in my work: it leaves the copy.
    expect(items.get('I_lib')).toBeUndefined();
});

test('an item removed from a project and another added between two polls: the removed one goes too', async () => {
    const world = sampleWorld();
    const { session, tracking, projects } = await setup(world);
    tracking.choose(TRACK_ALL);
    await session.clock.advance(0);

    // The count stays the same; the added item is in the narrowed read, so the count of the copy is one over.
    world.project.items = [
        ...world.project.items.filter(item => item.id !== 'PVTI_2'),
        { ...worldProjectItem('PVTI_4', nodeOf(world, 'I_web_3'), 'O_todo'), updatedAt: FRIDAY },
    ];
    world.project.etag = '"p2"';
    session.github.requests.length = 0;
    await session.clock.advance(60_000);

    expect(graphql(session.github.requests)).toEqual([
        'ProjectSchema PVT_1',
        'ProjectItems PVT_1 updated:>=2026-10-29',
        'ProjectItems PVT_1',
        'ProjectItems PVT_1 after 2',
    ]);
    expect(projects.getStoredItems('PVT_1').map(item => item.itemId)).toEqual(['PVTI_1', 'PVTI_3', 'PVTI_4']);
});

test('tracked items stay when they leave my work; untracking drops them unless something else keeps them', async () => {
    const world = sampleWorld();
    world.assigned = ['I_web_1', 'I_mine'];
    const { session, tracking, items } = await setup(world);
    tracking.choose(TRACK_ALL);
    await session.clock.advance(0);

    // Unassigned: still in a tracked repository (and project), so it stays.
    world.assigned = ['I_mine'];
    await session.clock.advance(30_000);
    expect(items.membership.assigned).toEqual(new Set(['I_mine']));
    expect(items.get('I_web_1')).toBeDefined();

    // acme/web untracked: its items go — but the one the project holds stays, as does my work's.
    world.assigned = ['I_mine', 'I_web_2'];
    await session.clock.advance(30_000);
    tracking.untrack({ kind: 'repository', nameWithOwner: 'acme/web' });
    expect(items.get('I_web_2')).toBeDefined();
    expect(items.get('PR_web_1')).toBeUndefined();
    expect(items.get('I_web_closed')).toBeUndefined();
    expect(items.get('I_web_1')).toBeDefined();
    expect(items.get('I_api_1')).toBeDefined();

    // The project untracked too: what it alone kept goes.
    tracking.untrack({ kind: 'project', id: 'PVT_1' });
    expect(items.get('I_web_1')).toBeUndefined();
    expect(items.get('I_other')).toBeUndefined();
    expect(items.get('I_web_2')).toBeDefined();
    expect(items.get('I_mine')).toBeDefined();
});

test('a used-up allowance pauses the download until it resets; signing out stops it, and nothing late is written', async () => {
    const world = sampleWorld();
    const { session, tracking, items, auth } = await setup(world);
    session.github.graphqlRemaining = 0;
    tracking.choose(TRACK_ALL);
    await session.clock.advance(0);

    // The page that used the last point came in; nothing more is asked until the reset (an hour on).
    const asked = graphql(session.github.requests).length;
    await session.clock.advance(30 * 60_000);
    expect(graphql(session.github.requests)).toHaveLength(asked);
    expect(tracking.getProgress({ kind: 'repository', nameWithOwner: 'acme/web' }).state).toBe('downloading');

    session.github.graphqlRemaining = 4000;
    const held = createPromise();
    session.github.hold = held.promise;
    await session.clock.advance(30 * 60_000);
    const before = session.github.requests.length;

    auth.signOut();
    held.resolve();
    await session.clock.advance(120_000);

    // The answer on its way when the user signed out was dropped, and nothing was asked after.
    expect(session.github.requests.length).toBe(before);
    expect(items.all).toEqual([]);
});

test('the download and a poll running side by side keep each other’s progress', async () => {
    const world = sampleWorld();
    const { session, tracking } = await setup(world);
    const web = { kind: 'repository', nameWithOwner: 'acme/web' } as const;
    // The download stops at acme/web's closed issues — its open items are in, so it is polled meanwhile.
    const closedPage = createPromise();
    session.github.holdIf = request =>
        request.operation === 'RepositoryIssues' &&
        request.variables.name === 'web' &&
        Array.isArray(request.variables.states) &&
        request.variables.states.includes('CLOSED')
            ? closedPage.promise
            : null;
    tracking.choose(TRACK_ALL);
    await session.clock.advance(0);
    expect(tracking.getSyncState(web)?.phase).toBe('closedIssues');

    // The poll answers and keeps its ETag, while the download's page is still on its way.
    await session.clock.advance(60_000);
    const etag = tracking.getSyncState(web)?.etag;
    expect(etag).toEqual(expect.any(String));

    // The next poll of acme/web is held in turn; the download's page comes in and the download finishes.
    const poll = createPromise();
    session.github.holdIf = request => (request.operation === 'GET /repos/acme/web/issues' ? poll.promise : null);
    const finished = session.clock.advance(60_000);
    closedPage.resolve();
    await finished;
    expect(tracking.getSyncState(web)).toMatchObject({ phase: 'done', etag });

    // The poll that started before the download finished does not take its progress back.
    poll.resolve();
    session.github.holdIf = null;
    session.github.requests.length = 0;
    await session.clock.advance(120_000);
    expect(downloads(session.github.requests).filter(read => !read.startsWith('search'))).toEqual([]);
    expect(restPolls(session.github.requests)).toContain('GET /repos/acme/web/issues conditional');
    const expected: TrackingProgress = { state: 'done', done: 6, total: 6 };
    expect(tracking.getProgress(web)).toEqual(expected);
});

test('a project download that has to start over counts its items once', async () => {
    const world = sampleWorld();
    const login = uniqueLogin();
    const persistence = createIndexedDbPersistence();
    const roadmap = { kind: 'project', id: 'PVT_1' } as const;
    // The project's second page never comes in the first tab, and the project itself is not kept.
    world.failing.add('ProjectItems 2');
    const first = await setup(world, { login, persistence });
    first.tracking.choose({ repositories: [], projects: TRACK_ALL.projects });
    await first.session.clock.advance(0);
    expect(first.tracking.getSyncState(roadmap)?.cursor).toBe('2');
    await persistence.deleteProject(login, 'PVT_1');

    world.failing.clear();
    const second = await setup(world, {
        login,
        persistence: createIndexedDbPersistence(),
        localStorage: first.session.localStorage,
    });
    await second.session.clock.advance(0);

    // Read again from its first page: what the first tab counted is not counted twice.
    const expected: TrackingProgress = { state: 'done', done: 3, total: 3 };
    expect(second.tracking.getProgress(roadmap)).toEqual(expected);
});

test('a project hidden during its first download is downloaded once GitHub shows it again', async () => {
    const world = sampleWorld();
    world.project.shown = false;
    const { session, tracking, projects } = await setup(world);
    const roadmap = { kind: 'project', id: 'PVT_1' } as const;
    tracking.choose(TRACK_ALL);
    await session.clock.advance(0);
    expect(tracking.getProgress(roadmap).state).toBe('hidden');

    // Still hidden: the poll asks about it (free), and nothing more.
    session.github.requests.length = 0;
    await session.clock.advance(60_000);
    expect(restPolls(session.github.requests)).toContain('GET /orgs/acme/projectsV2/1 unconditional');
    expect(tracking.getProgress(roadmap).state).toBe('hidden');

    world.project.shown = true;
    await session.clock.advance(60_000);
    const expected: TrackingProgress = { state: 'done', done: 3, total: 3 };
    expect(tracking.getProgress(roadmap)).toEqual(expected);
    expect(projects.getStoredItems('PVT_1').map(item => item.itemId)).toEqual(['PVTI_1', 'PVTI_2', 'PVTI_3']);
});

test('a page on its way when its repository or project is untracked brings nothing back', async () => {
    const world = sampleWorld();
    const { session, tracking, items, projects } = await setup(world);
    const issuesPage = createPromise();
    const projectPage = createPromise();
    session.github.holdIf = request => {
        if (request.variables.after !== '2') {
            return null;
        }

        if (request.operation === 'RepositoryIssues' && request.variables.name === 'web') {
            return issuesPage.promise;
        }

        return request.operation === 'ProjectItems' ? projectPage.promise : null;
    };
    tracking.choose(TRACK_ALL);
    await session.clock.advance(0);

    // acme/web's second page of open issues (I_web_3) is on its way when it is untracked.
    tracking.untrack({ kind: 'repository', nameWithOwner: 'acme/web' });
    issuesPage.resolve();
    await session.clock.advance(0);
    expect(items.get('I_web_3')).toBeUndefined();
    expect(items.get('I_api_1')).toBeDefined();

    // The project's second page (I_other) likewise.
    expect(projects.get('PVT_1')).toBeDefined();
    tracking.untrack({ kind: 'project', id: 'PVT_1' });
    projectPage.resolve();
    await session.clock.advance(0);
    expect(projects.get('PVT_1')).toBeUndefined();
    expect(projects.getStoredItems('PVT_1')).toEqual([]);
    expect(items.get('I_other')).toBeUndefined();
});

test('a project no longer tracked but still in the kept copy — and the rows only it held — go when the copy is read', async () => {
    const world = sampleWorld();
    const login = uniqueLogin();
    const persistence = createIndexedDbPersistence();
    const first = await setup(world, { login, persistence });
    first.tracking.choose({ repositories: [], projects: TRACK_ALL.projects });
    await first.session.clock.advance(0);
    expect(first.items.get('I_lib')).toBeDefined();
    // Untracked, but a read on its way wrote the project and its rows back afterwards.
    first.session.localStorage.set(
        `githq.settings.${login}`,
        JSON.stringify({
            chosen: true,
            document: {
                version: 1,
                repositories: [],
                projects: [
                    { id: 'PVT_1', owner: 'acme', ownerKind: 'org', number: 1, title: 'Roadmap', tracking: false },
                ],
            },
        }),
    );

    const reloaded = createIndexedDbPersistence();
    const second = await setup(world, { login, persistence: reloaded, localStorage: first.session.localStorage });
    // The rows go with the first poll of "my work", which drops whatever nothing keeps.
    expect(second.projects.get('PVT_1')).toBeUndefined();
    expect(second.items.get('I_lib')).toBeUndefined();
    expect(second.items.get('I_web_1')).toBeUndefined();
    expect((await reloaded.loadProjects(login)).projects).toEqual([]);
});

test('a project whose REST GitHub refuses is asked through GraphQL every 5 minutes, and read again when it changed', async () => {
    const world = sampleWorld();
    world.project.restRefused = true;
    const { session, tracking, projects, sync } = await setup(world);
    const roadmap = { kind: 'project', id: 'PVT_1' } as const;
    tracking.choose(TRACK_ALL);
    await session.clock.advance(0);
    expect(tracking.getSyncState(roadmap)?.refused).toMatchObject({ status: 403 });

    // Asked through GraphQL at the next poll — read again once, as nothing tells what changed before.
    await session.clock.advance(60_000);
    expect(sync.getProjectFreshness('PVT_1').kind).toBe('fresh');

    // Then every 5 minutes, not at every poll, and the REST it refuses is not asked meanwhile.
    session.github.requests.length = 0;
    await session.clock.advance(4 * 60_000);
    expect(probes(session.github.requests)).toBe(0);
    await session.clock.advance(60_000);
    expect(probes(session.github.requests)).toBe(1);
    expect(restPolls(session.github.requests)).not.toContain('GET /orgs/acme/projectsV2/1 conditional');
    expect(graphql(session.github.requests)).toEqual(['ProjectUpdatedAt PVT_1']);
    expect(sync.getProjectFreshness('PVT_1').kind).toBe('fresh');

    // A field changed: the project moves its `updatedAt`, and the item is read again.
    world.project.items = world.project.items.map(item =>
        item.id === 'PVTI_3'
            ? { ...worldProjectItem('PVTI_3', nodeOf(world, 'I_other'), 'O_done'), updatedAt: FRIDAY }
            : item,
    );
    world.project.updatedAt = FRIDAY;
    session.github.requests.length = 0;
    await session.clock.advance(5 * 60_000);
    expect(graphql(session.github.requests)).toEqual([
        'ProjectUpdatedAt PVT_1',
        'ProjectSchema PVT_1',
        'ProjectItems PVT_1 updated:>=2026-10-29',
    ]);
    expect(projects.getStoredItem('PVTI_3')?.values.F_status).toMatchObject({ name: 'Done' });
});

test('a repository whose changes GitHub refuses is said so, and asked again an hour later; the others go on', async () => {
    const world = sampleWorld();
    world.refusedRepositories.add('acme/web');
    const { session, tracking, sync } = await setup(world);
    tracking.choose(TRACK_ALL);
    await session.clock.advance(0);

    expect(tracking.getSyncState({ kind: 'repository', nameWithOwner: 'acme/web' })?.refused).toMatchObject({
        status: 403,
    });
    expect(sync.getRepositoryFreshness('acme/web')).toMatchObject({ kind: 'stale', reason: 'refused' });
    expect(sync.getRepositoryFreshness('acme/api').kind).toBe('fresh');

    session.github.requests.length = 0;
    await session.clock.advance(2 * 60_000);
    expect(restPolls(session.github.requests)).not.toContain('GET /repos/acme/web/issues unconditional');
    expect(restPolls(session.github.requests)).toContain('GET /repos/acme/api/issues conditional');
    expect(sync.getRepositoryFreshness('acme/api').kind).toBe('fresh');
    expect(sync.getProjectFreshness('PVT_1').kind).toBe('fresh');

    // GitHub answers again: the repository is followed again (the tab hidden meanwhile, so the polls are fewer).
    world.refusedRepositories.clear();
    session.setVisible(false);
    await session.clock.advance(60 * 60_000);
    session.setVisible(true);
    await session.clock.advance(0);
    expect(restPolls(session.github.requests)).toContain('GET /repos/acme/web/issues unconditional');
    expect(sync.getRepositoryFreshness('acme/web').kind).toBe('fresh');
});

test('a poll failing for one repository does not hide that another is still downloading', async () => {
    const world = sampleWorld();
    const { session, tracking, sync } = await setup(world);
    // acme/api's open issues are on their way; acme/web's are in, and its poll fails.
    const apiPage = createPromise();
    session.github.holdIf = request =>
        request.operation === 'RepositoryIssues' && request.variables.name === 'api' ? apiPage.promise : null;
    world.failing.add('GET /repos/acme/web/issues');
    tracking.choose(TRACK_ALL);
    await session.clock.advance(60_000);

    expect(sync.getRepositoryFreshness('acme/web')).toMatchObject({ kind: 'stale', reason: 'failing' });
    expect(sync.getRepositoryFreshness('acme/api')).toEqual({ kind: 'partial' });
    apiPage.resolve();
});

/** The world of these tests: two repositories, a project holding one of their issues and two others. */
function sampleWorld(): TrackingWorld {
    const world = createTrackingWorld();
    const nodes = [
        sampleIssueNode('I_web_1', { repository: 'acme/web', number: 1, updatedAt: MONDAY }),
        sampleIssueNode('I_web_2', { repository: 'acme/web', number: 2, updatedAt: MONDAY }),
        sampleIssueNode('I_web_3', { repository: 'acme/web', number: 3, updatedAt: MONDAY }),
        sampleIssueNode('I_web_closed', { repository: 'acme/web', number: 4, updatedAt: MONDAY, open: false }),
        samplePullRequestNode('PR_web_1', { repository: 'acme/web', number: 5, updatedAt: MONDAY }),
        samplePullRequestNode('PR_web_merged', { repository: 'acme/web', number: 6, updatedAt: MONDAY, open: false }),
        sampleIssueNode('I_api_1', { repository: 'acme/api', number: 1, updatedAt: MONDAY }),
        sampleIssueNode('I_lib', { repository: 'other/lib', number: 1, updatedAt: MONDAY }),
        sampleIssueNode('I_other', { repository: 'other/lib', number: 2, updatedAt: MONDAY }),
        sampleIssueNode('I_mine', { repository: 'someone/else', number: 1, updatedAt: MONDAY }),
    ];
    for (const node of nodes) {
        world.items.set(node.id, node);
    }

    world.project.items = [
        worldProjectItem('PVTI_1', nodeOf(world, 'I_web_1'), 'O_todo'),
        worldProjectItem('PVTI_2', nodeOf(world, 'I_lib'), null),
        worldProjectItem('PVTI_3', nodeOf(world, 'I_other'), 'O_todo'),
    ];
    return world;
}

function nodeOf(world: TrackingWorld, id: string) {
    const node = world.items.get(id);
    if (!node) {
        throw new Error(`No ${id} in the world`);
    }

    return node;
}

interface SetupOptions {
    readonly login?: string;
    readonly persistence?: IndexedDbPersistence;
    /** The `localStorage` of an earlier session, to reload it. */
    readonly localStorage?: Map<string, string>;
}

/** Signs a user in against the world, with an empty kept copy unless given one, and lets the first poll run. */
async function setup(world: TrackingWorld, options: SetupOptions = {}) {
    const session = createTestSession({
        login: options.login ?? uniqueLogin(),
        answer: request => world.answer(request),
        answerRest: request => world.answerRest(request),
        localStorage: options.localStorage,
    });
    setIndexedDbPersistence(session.container, options.persistence);

    const auth = session.container.resolve(AuthStore);
    const items = session.container.resolve(ItemStore);
    const tracking = session.container.resolve(TrackingStore);
    const projects = session.container.resolve(ProjectStore);
    const sync = session.container.resolve(SyncEngine);
    await items.ready();
    await session.clock.advance(0);

    return { session, auth, items, tracking, projects, sync };
}

/** The searches and the download's reads (not the polls'), in order, as `<operation> <what> [after <cursor>]`. */
function downloads(requests: readonly TestGraphQLRequest[]) {
    const read: string[] = [];
    for (const { operation, variables } of requests) {
        const after = typeof variables.after === 'string' ? ` after ${variables.after}` : '';
        if (operation === 'GET /search/issues') {
            read.push(`search ${String(variables.q)}`);
        } else if (operation === 'RepositoryIssues' || operation === 'RepositoryPullRequests') {
            const states = Array.isArray(variables.states) ? variables.states.join(',') : '';
            read.push(`${operation} ${String(variables.owner)}/${String(variables.name)} ${states}${after}`);
        } else if (operation === 'ProjectFull' || (operation === 'ProjectItems' && variables.query === '')) {
            read.push(`${operation} ${String(variables.id)}${after}`);
        }
    }

    return read;
}

/** The GraphQL reads, as `<operation> <ids or project> [query] [after <cursor>]`. */
function graphql(requests: readonly TestGraphQLRequest[]) {
    const read: string[] = [];
    for (const { operation, variables } of requests) {
        if (operation.startsWith('GET ') || operation === 'Viewer' || operation === 'PullRequestStatuses') {
            continue;
        }

        const target = Array.isArray(variables.ids) ? variables.ids.join(',') : String(variables.id);
        const query = typeof variables.query === 'string' && variables.query !== '' ? ` ${variables.query}` : '';
        const after = typeof variables.after === 'string' ? ` after ${variables.after}` : '';
        read.push(`${operation} ${target}${query}${after}`);
    }

    return read;
}

/** The REST polls of tracked repositories and projects, and whether they carried the last ETag. */
function restPolls(requests: readonly TestGraphQLRequest[]) {
    return requests
        .filter(request => request.operation.startsWith('GET /repos') || request.operation.startsWith('GET /orgs'))
        .map(
            request =>
                `${request.operation} ${request.variables.ifNoneMatch === null ? 'unconditional' : 'conditional'}`,
        );
}

function uniqueLogin() {
    return `user-${crypto.randomUUID()}`;
}

/** How many times GitHub was asked through GraphQL whether the project changed. */
function probes(requests: readonly TestGraphQLRequest[]) {
    return requests.filter(request => request.operation === 'ProjectUpdatedAt').length;
}
