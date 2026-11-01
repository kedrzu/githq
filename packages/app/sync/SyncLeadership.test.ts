/// <reference types="bun" />
// IndexedDB for bun, shared by the tabs of a test as a browser's is. Every test uses its own login, so their
// databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import { AuthStore } from '@/auth/AuthStore.js';
import { ProjectStore } from '@/projects/ProjectStore.js';
import { ProjectViewAnswers } from '@/projects/ProjectViewAnswers.js';
import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { createIndexedDbPersistence } from '@/store/IndexedDbPersistence.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { ItemOverlay } from '@/store/ItemOverlay.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { TestGraphQLAnswer, TestGraphQLRequest } from '@/testing/createTestSession.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { createTestTabs } from '@/testing/createTestTabs.js';
import type { TestTabs } from '@/testing/createTestTabs.js';
import { createTrackingWorld, worldProjectItem } from '@/testing/createTrackingWorld.js';
import type { TrackingWorld } from '@/testing/createTrackingWorld.js';
import { sampleIssueDetailNode } from '@/testing/sampleDetailNodes.js';
import { sampleIssueNode } from '@/testing/sampleRowNodes.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import type { TrackingChoice } from '@/tracking/TrackingStore.js';

import { DetailPrefetch } from './DetailPrefetch.js';
import { SyncEngine } from './SyncEngine.js';

const MONDAY = '2026-10-26T10:00:00Z';
const FRIDAY = '2026-10-30T13:20:00Z';

const TRACK_ALL: TrackingChoice = {
    repositories: [{ nameWithOwner: 'acme/web', id: 'R_web' }],
    projects: [{ id: 'PVT_1', owner: 'acme', ownerKind: 'org', number: 1, title: 'Roadmap' }],
};

test('of two tabs only the one holding the lock asks GitHub; the other shows the same items, tracking, projects, details and freshness', async () => {
    const world = sampleWorld();
    const browser = createTestTabs();
    const login = uniqueLogin();
    const first = openTab(world, browser, login);
    const second = openTab(world, browser, login);
    await advance([first, second], 0);

    // Chosen in the tab that does not sync: the one that does downloads it.
    second.tracking.choose(TRACK_ALL);
    await advance([first, second], 0);
    await advance([first, second], 60_000);

    expect(polls(first)).toContain('GET /search/issues');
    expect(polls(first)).toContain('RepositoryIssues');
    expect(polls(first)).toContain('ItemDetails');
    expect(polls(second)).toEqual([]);
    // It wrote nothing to the copy they share: its choice is kept in `localStorage`, the syncing tab wrote the rest.
    expect(second.writes).toEqual([]);

    expect(second.items.all).toEqual(first.items.all);
    expect(second.items.membership).toEqual(first.items.membership);
    expect(second.tracking.repositories).toEqual(TRACK_ALL.repositories);
    expect(second.tracking.getProgress({ kind: 'repository', nameWithOwner: 'acme/web' }).state).toBe('done');
    expect(second.projects.getItems('PVT_1')).toEqual(first.projects.getItems('PVT_1'));
    expect(second.projects.get('PVT_1')?.title).toBe('Roadmap');
    expect(second.details.get('I_mine')?.body).toBe('Body of I_mine');
    expect(second.rateLimits.get('graphql')?.remaining).toBe(first.rateLimits.get('graphql')?.remaining ?? -1);

    const fresh = first.sync.myWorkFreshness;
    expect(fresh.kind).toBe('fresh');
    expect(second.sync.myWorkFreshness).toEqual(fresh);
    expect(second.sync.getRepositoryFreshness('acme/web')).toEqual(first.sync.getRepositoryFreshness('acme/web'));
    expect(second.sync.getProjectFreshness('PVT_1')).toEqual(first.sync.getProjectFreshness('PVT_1'));

    // A hidden tab polls less often only while every tab is hidden.
    first.session.setVisible(false);
    await advance([first, second], 30_000);
    expect(count(first, 'GET /search/issues')).toBe(4 * 4);
    second.session.setVisible(false);
    await advance([first, second], 30_000);
    expect(count(first, 'GET /search/issues')).toBe(4 * 4);
    expect(polls(second)).toEqual([]);
});

test('when the syncing tab closes, the other takes over from the shared copy: no download again, every loop waits for the rest of its interval, the ETags are sent', async () => {
    const world = sampleWorld();
    const browser = createTestTabs();
    const login = uniqueLogin();
    const first = openTab(world, browser, login);
    const second = openTab(world, browser, login);
    await advance([first, second], 0);
    first.tracking.choose(TRACK_ALL);
    await advance([first, second], 10_000);
    expect(polls(second)).toEqual([]);

    first.session.tab.close();
    await advance([second], 0);
    // My work was searched 10 seconds ago: not again before its 30 seconds are up, and the download is done.
    expect(polls(second)).toEqual([]);

    await advance([second], 20_000);
    expect(count(second, 'GET /search/issues')).toBe(4);
    await advance([second], 30_000);
    const repositoryPolls = second.session.github.requests.filter(
        request => request.operation === 'GET /repos/acme/web/issues',
    );
    expect(repositoryPolls).toHaveLength(1);
    expect(repositoryPolls[0]?.variables.ifNoneMatch).not.toBeNull();
    expect(polls(second)).not.toContain('RepositoryIssues');
    expect(polls(second)).not.toContain('ProjectFull');

    // What changes on GitHub now comes in through the tab that took over.
    world.items.set('I_mine', { ...nodeOf(world, 'I_mine'), title: 'Renamed', updatedAt: FRIDAY });
    await advance([second], 30_000);
    expect(second.items.get('I_mine')?.title).toBe('Renamed');
    expect(second.sync.myWorkFreshness.kind).toBe('fresh');
});

test('a frozen syncing tab gives the lock up to the other; resumed, it waits in line', async () => {
    const world = sampleWorld();
    const browser = createTestTabs();
    const login = uniqueLogin();
    const first = openTab(world, browser, login);
    const second = openTab(world, browser, login);
    await advance([first, second], 0);

    first.session.tab.lifecycle('freeze');
    await advance([first, second], 30_000);
    expect(count(second, 'GET /search/issues')).toBe(4);

    first.session.tab.lifecycle('resume');
    const before = count(first, 'GET /search/issues');
    await advance([first, second], 30_000);
    expect(count(first, 'GET /search/issues')).toBe(before);
    expect(count(second, 'GET /search/issues')).toBe(8);
});

test('a change a tab makes itself — an edit GitHub confirmed — shows in the other; an edit still on its way is not drawn over by an older sync', async () => {
    const world = sampleWorld();
    const browser = createTestTabs();
    const login = uniqueLogin();
    const first = openTab(world, browser, login);
    const second = openTab(world, browser, login);
    await advance([first, second], 0);

    // An edit on its way in the tab that does not sync, while the syncing tab reads the item as GitHub had it.
    second.container.resolve(ItemOverlay).add('I_mine', { item: item => ({ ...item, title: 'Mine, on its way' }) });
    world.items.set('I_mine', { ...nodeOf(world, 'I_mine'), title: 'Theirs', updatedAt: FRIDAY });
    await advance([first, second], 30_000);
    expect(second.items.getStored('I_mine')?.title).toBe('Theirs');
    expect(second.items.get('I_mine')?.title).toBe('Mine, on its way');

    // GitHub confirmed an edit in the other tab: it writes it into its stores, as the edit queue does.
    const stored = second.items.getStored('I_mine');
    if (!stored) {
        throw new Error('I_mine is not in the store');
    }

    second.items.upsertMany([{ ...stored, title: 'Confirmed', updatedAt: '2026-10-30T13:30:00Z' }]);
    await advance([first, second], 0);
    expect(first.items.get('I_mine')?.title).toBe('Confirmed');
    expect(polls(second)).toEqual([]);

    // A sync answer older than the confirmed edit, read before it, does not take its place in the edit's tab.
    first.items.upsertMany([{ ...stored, title: 'Read before the edit' }]);
    await advance([first, second], 0);
    expect(second.items.get('I_mine')?.title).not.toBe('Read before the edit');
});

test('a pause for the allowance shows in every tab, and the allowance any tab learns reaches the others', async () => {
    const world = sampleWorld();
    const browser = createTestTabs();
    const login = uniqueLogin();
    const first = openTab(world, browser, login);
    const second = openTab(world, browser, login);
    await advance([first, second], 0);
    first.tracking.choose(TRACK_ALL);
    await advance([first, second], 0);

    // REST's allowance runs out at the next poll of the tracked repository.
    first.session.github.coreRemaining = 0;
    await advance([first, second], 60_000);
    expect(first.sync.notice?.kind).toBe('paused');
    expect(second.sync.notice).toEqual(first.sync.notice);
    expect(second.rateLimits.get('core')?.remaining).toBe(0);

    // An answer in the other tab — an item opened there — reports what is left of GraphQL.
    second.session.github.graphqlRemaining = 1234;
    await second.details.ensure('I_mine');
    await advance([first, second], 0);
    expect(first.rateLimits.get('graphql')?.remaining).toBe(1234);
});

test('a view GitHub answers, shown in the tab that does not sync, is asked by the one that does, and its answer comes back', async () => {
    const world = sampleWorld();
    const browser = createTestTabs();
    const login = uniqueLogin();
    const first = openTab(world, browser, login);
    const second = openTab(world, browser, login);
    await advance([first, second], 0);
    first.tracking.choose(TRACK_ALL);
    await advance([first, second], 0);

    const view = { projectId: 'PVT_1', filter: 'reviewers:octocat', term: 'reviewers:octocat' };
    const stop = second.answers.show(view);
    await advance([first, second], 0);

    expect(count(first, 'ProjectItems', request => request.variables.query === view.filter)).toBe(1);
    expect(polls(second)).toEqual([]);
    expect(second.answers.get(view.projectId, view.filter).ids).toEqual(
        first.answers.get(view.projectId, view.filter).ids ?? new Set(['none']),
    );

    stop();
    await advance([first, second], 10 * 60_000);
    expect(count(first, 'ProjectItems', request => request.variables.query === view.filter)).toBe(1);
});

test('tabs of different accounts share nothing; a tab signed into another account leaves the first one’s lock and channel', async () => {
    const world = sampleWorld();
    const browser = createTestTabs();
    const alice = uniqueLogin();
    const bob = uniqueLogin();
    const first = openTab(world, browser, alice);
    const second = openTab(world, browser, alice);
    const third = openTab(world, browser, bob);
    await advance([first, second, third], 0);

    // Bob's tab syncs for bob: it does not wait for alice's lock.
    expect(count(third, 'GET /search/issues')).toBe(4);
    expect(polls(second)).toEqual([]);

    // The second tab signs into bob's account: it no longer hears alice's changes, and bob's tabs sync as one.
    second.session.signInFromAnotherTab(bob);
    await advance([first, second, third], 0);
    const mine = first.items.getStored('I_mine');
    expect(mine).toBeDefined();
    first.items.upsertMany(mine ? [{ ...mine, title: 'Alice’s change' }] : []);
    await advance([first, second, third], 0);
    expect(second.items.get('I_mine')?.title).toBe('Issue I_mine');
    expect(third.items.get('I_mine')?.title).toBe('Issue I_mine');

    // Alice's tab closes: the second tab does not take over alice's polling — it waits for bob's lock only.
    const asked = second.session.github.requests.length;
    first.session.tab.close();
    const searches = count(second, 'GET /search/issues') + count(third, 'GET /search/issues');
    await advance([second, third], 30_000);
    expect(count(second, 'GET /search/issues') + count(third, 'GET /search/issues')).toBe(searches + 4);
    expect(second.session.github.requests.slice(asked).map(request => request.token)).not.toContain(`gho_${alice}`);
});

/** A GitHub with a few items: two of them in "my work", one in the tracked project. */
function sampleWorld(): TrackingWorld {
    const world = createTrackingWorld();
    const nodes = [
        sampleIssueNode('I_web_1', { repository: 'acme/web', number: 1, updatedAt: MONDAY }),
        sampleIssueNode('I_web_2', { repository: 'acme/web', number: 2, updatedAt: MONDAY }),
        sampleIssueNode('I_mine', { repository: 'someone/else', number: 1, updatedAt: MONDAY }),
    ];
    for (const node of nodes) {
        world.items.set(node.id, node);
    }

    world.assigned = ['I_mine', 'I_web_1'];
    world.project.items = [worldProjectItem('PVTI_1', nodeOf(world, 'I_web_1'), 'O_todo')];
    return world;
}

function nodeOf(world: TrackingWorld, id: string) {
    const node = world.items.get(id);
    if (!node) {
        throw new Error(`No ${id} in the world`);
    }

    return node;
}

/** A tab of `browser` signed in as `login`, with every service that asks GitHub by itself running. */
function openTab(world: TrackingWorld, browser: TestTabs, login: string) {
    const session = createTestSession({
        login,
        answer: request => answerDetails(world, request) ?? world.answer(request),
        answerRest: request => world.answerRest(request),
        tabs: browser,
    });
    const persistence = createIndexedDbPersistence();
    /** The writes with something in them, by method. */
    const writes: string[] = [];
    setIndexedDbPersistence(session.container, {
        ...persistence,
        save: async (owner, changes) => {
            if (changes.upserted.length + changes.removed.length > 0 || changes.membership || changes.sync) {
                writes.push('save');
            }

            await persistence.save(owner, changes);
        },
        saveDetails: async (owner, details) => {
            writes.push('saveDetails');
            await persistence.saveDetails(owner, details);
        },
        saveProject: async (owner, project) => {
            writes.push('saveProject');
            await persistence.saveProject(owner, project);
        },
        saveProjectItems: async (owner, changes) => {
            if (changes.upserted.length + changes.removed.length > 0) {
                writes.push('saveProjectItems');
            }

            await persistence.saveProjectItems(owner, changes);
        },
        saveSyncState: async (owner, state) => {
            writes.push('saveSyncState');
            await persistence.saveSyncState(owner, state);
        },
    });
    const { container } = session;
    container.resolve(AuthStore);

    return {
        session,
        container,
        writes,
        items: container.resolve(ItemStore),
        tracking: container.resolve(TrackingStore),
        projects: container.resolve(ProjectStore),
        details: container.resolve(ItemDetailStore),
        rateLimits: container.resolve(GitHubRateLimitStore),
        sync: container.resolve(SyncEngine),
        prefetch: container.resolve(DetailPrefetch),
        answers: container.resolve(ProjectViewAnswers),
    };
}

type Tab = ReturnType<typeof openTab>;

/** Moves every tab's clock on by `ms`, one after the other, letting what they send each other arrive. */
async function advance(tabs: readonly Tab[], ms: number) {
    for (const tab of tabs) {
        await tab.items.ready();
        await tab.session.clock.advance(ms);
    }

    for (const tab of tabs) {
        await tab.session.clock.advance(0);
    }
}

/** What the tab asked GitHub, by operation — besides who the user is, which every tab checks once it opens. */
function polls(tab: Tab) {
    return tab.session.github.requests.map(request => request.operation).filter(operation => operation !== 'Viewer');
}

function count(tab: Tab, operation: string, matches: (request: TestGraphQLRequest) => boolean = () => true) {
    return tab.session.github.requests.filter(request => request.operation === operation && matches(request)).length;
}

/** The details the prefetch and an opened item read, which the tracking world does not answer. */
function answerDetails(world: TrackingWorld, request: TestGraphQLRequest): TestGraphQLAnswer | undefined {
    const { operation, variables } = request;
    if (operation === 'ItemDetails' && Array.isArray(variables.ids)) {
        return { data: { nodes: variables.ids.map(id => detailOf(String(id))) } };
    }

    if (operation === 'ItemDetail') {
        return { data: { node: detailOf(String(variables.id)) } };
    }

    return undefined;

    function detailOf(id: string) {
        const node = nodeOf(world, id);
        return { ...sampleIssueDetailNode(id, node.updatedAt), title: node.title };
    }
}

function uniqueLogin() {
    return `user-${crypto.randomUUID()}`;
}
