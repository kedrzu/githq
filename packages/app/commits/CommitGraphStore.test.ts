/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import { createPromise } from '@nzyme/utils/createPromise.js';

import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { createIndexedDbPersistence } from '@/store/IndexedDbPersistence.js';
import type { IndexedDbPersistence } from '@/store/IndexedDbPersistence.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Freshness } from '@/sync/Freshness.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { fakeCommitGitHub } from '@/testing/fakeCommitGitHub.js';
import type { FakeCommitGitHub } from '@/testing/fakeCommitGitHub.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { CommitGraphStore } from './CommitGraphStore.js';
import type { CommitState } from './CommitTypes.js';

test('a first open shows the default branch at once, then joins a branch a few commits ahead', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.line('c', 0, 120);
    web.branch('main', 'c119');
    web.add('f1', 1191, ['c118']);
    web.add('f2', 1192, ['f1']);
    web.add('f3', 1193, ['f2']);
    web.branch('feature', 'f3');

    const { graphs, session, requests } = setup(uniqueLogin(), world);
    const held = createPromise();
    session.github.holdIf = request => (request.operation === 'CommitHistories' ? held.promise : null);
    const opened = graphs.open('acme/web');
    await session.clock.advance(0);

    // The first page of the default branch is shown before the branch is joined.
    expect(shownOids(graphs, 'acme/web')).toEqual(oids('c', 20, 120).toReversed());
    expect(graphs.get('acme/web')?.joining).toBe(true);
    const fresh: Freshness = { kind: 'fresh', checkedAt: session.clock.now() };
    expect(graphs.getFreshness('acme/web')).toEqual(fresh);

    held.resolve();
    await opened;

    const graph = graphs.get('acme/web');
    expect(graph?.joining).toBe(false);
    expect(graph?.commits.slice(0, 4).map(commit => commit.oid)).toEqual(['f3', 'f2', 'f1', 'c119']);
    expect(graph?.layout.rows).toHaveLength(103);
    expect(graph?.refs?.branches.map(branch => branch.name)).toEqual(['feature', 'main']);
    expect(requests()).toEqual([
        { operation: 'RepositoryCommitRefs', variables: refsVariables('web', true) },
        { operation: 'CommitHistories', variables: { ids: ['C_f3'], first: 20 } },
    ]);
});

test('a branch forking deep below its tip is read down to the loaded history in a second, bigger round', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.line('c', 0, 120);
    web.branch('main', 'c119');
    web.add('d0', 1001, ['c100']);
    web.line('d', 1, 30, 1002);
    web.branch('deep', 'd29');

    const { graphs, requests } = setup(uniqueLogin(), world);
    await graphs.open('acme/web');

    expect(requests().slice(1)).toEqual([
        { operation: 'CommitHistories', variables: { ids: ['C_d29'], first: 20 } },
        { operation: 'CommitHistories', variables: { ids: ['C_d9'], first: 50 } },
    ]);
    const shown = shownOids(graphs, 'acme/web');
    expect(shown).toContain('d0');
    expect(shown).toContain('d29');
    expect(graphs.get('acme/web')?.joining).toBe(false);
});

test('a repository opened before draws its kept commits before any answer, then fills in a branch that moved', async () => {
    const login = uniqueLogin();
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.line('c', 0, 50);
    web.branch('main', 'c49');
    const before = setup(login, world);
    await before.graphs.open('acme/web');
    await before.session.clock.advance(0);

    // Meanwhile main moved on by two commits.
    web.add('c50', 500, ['c49']);
    web.add('c51', 510, ['c50']);
    web.branch('main', 'c51');
    const after = setup(login, world, before.persistence);
    const held = createPromise();
    after.session.github.hold = held.promise;
    const opened = after.graphs.open('acme/web');
    await after.session.clock.advance(0);

    expect(shownOids(after.graphs, 'acme/web')).toEqual(oids('c', 0, 50).toReversed());
    expect(after.graphs.getFreshness('acme/web').kind).toBe('checking');
    expect(after.requests().map(request => request.operation)).toEqual(['RepositoryCommitRefs']);

    held.resolve();
    await opened;

    expect(shownOids(after.graphs, 'acme/web')).toEqual(oids('c', 0, 52).toReversed());
    expect(after.requests()).toEqual([
        { operation: 'RepositoryCommitRefs', variables: refsVariables('web', false) },
        { operation: 'CommitHistories', variables: { ids: ['C_c51'], first: 20 } },
    ]);
});

test('a branch that moved goes on being drawn from where it was until its new commits arrive', async () => {
    const login = uniqueLogin();
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.line('c', 0, 10);
    web.branch('main', 'c9');
    const before = setup(login, world);
    await before.graphs.open('acme/web');
    await before.session.clock.advance(0);

    web.add('c10', 100, ['c9']);
    web.branch('main', 'c10');
    const after = setup(login, world, before.persistence);
    const held = createPromise();
    after.session.github.holdIf = request => (request.operation === 'CommitHistories' ? held.promise : null);
    const opened = after.graphs.open('acme/web');
    await after.session.clock.advance(0);

    expect(after.graphs.get('acme/web')?.joining).toBe(true);
    expect(after.graphs.get('acme/web')?.refs?.branches[0]?.oid).toBe('c10');
    expect(shownOids(after.graphs, 'acme/web')).toEqual(oids('c', 0, 10).toReversed());

    held.resolve();
    await opened;
    expect(shownOids(after.graphs, 'acme/web')).toEqual(oids('c', 0, 11).toReversed());
});

test("a force-pushed branch's old commits are no longer shown", async () => {
    const login = uniqueLogin();
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.line('c', 0, 10);
    web.branch('main', 'c9');
    web.add('f1', 95, ['c8']);
    web.branch('feature', 'f1');
    const before = setup(login, world);
    await before.graphs.open('acme/web');
    await before.session.clock.advance(0);
    expect(shownOids(before.graphs, 'acme/web')).toContain('f1');

    web.add('g1', 96, ['c8']);
    web.branch('feature', 'g1');
    const after = setup(login, world, before.persistence);
    await after.graphs.open('acme/web');

    const shown = shownOids(after.graphs, 'acme/web');
    expect(shown).toContain('g1');
    expect(shown).not.toContain('f1');
});

test("a deleted branch's commits are no longer shown, unless another ref still reaches them", async () => {
    const login = uniqueLogin();
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.line('c', 0, 10);
    web.branch('main', 'c9');
    web.add('a1', 95, ['c8']);
    web.branch('a', 'a1');
    web.add('b1', 96, ['c8']);
    web.add('b2', 97, ['b1']);
    web.branch('b', 'b2');
    web.tag('v1', 'b1');
    const before = setup(login, world);
    await before.graphs.open('acme/web');
    await before.session.clock.advance(0);
    expect(shownOids(before.graphs, 'acme/web')).toEqual(expect.arrayContaining(['a1', 'b1', 'b2']));

    web.deleteBranch('a');
    web.deleteBranch('b');
    const after = setup(login, world, before.persistence);
    await after.graphs.open('acme/web');

    const shown = shownOids(after.graphs, 'acme/web');
    expect(shown).toContain('b1');
    expect(shown).not.toContain('a1');
    expect(shown).not.toContain('b2');
    expect(after.graphs.get('acme/web')?.refs?.branches.map(branch => branch.name)).toEqual(['main']);
});

test('scrolling down reads the next pages from where the history stops, one at a time, until its end', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.line('c', 0, 250);
    web.branch('main', 'c249');
    const { graphs, session, requests } = setup(uniqueLogin(), world);
    await graphs.open('acme/web');
    expect(graphs.get('acme/web')?.endReached).toBe(false);

    const held = createPromise();
    session.github.hold = held.promise;
    const first = graphs.loadMore('acme/web');
    const again = graphs.loadMore('acme/web');
    await session.clock.advance(0);
    expect(graphs.get('acme/web')?.loadingMore).toBe(true);
    held.resolve();
    session.github.hold = null;
    await Promise.all([first, again]);

    expect(graphs.get('acme/web')?.loadingMore).toBe(false);
    expect(shownOids(graphs, 'acme/web')).toEqual(oids('c', 50, 250).toReversed());

    await graphs.loadMore('acme/web');
    expect(shownOids(graphs, 'acme/web')).toEqual(oids('c', 0, 250).toReversed());
    expect(graphs.get('acme/web')?.endReached).toBe(true);

    await graphs.loadMore('acme/web');
    expect(requests().slice(1)).toEqual([
        { operation: 'CommitHistories', variables: { ids: ['C_c149'], first: 100 } },
        { operation: 'CommitHistories', variables: { ids: ['C_c49'], first: 100 } },
    ]);
});

test('nothing is asked once the GraphQL allowance is spent', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.line('c', 0, 10);
    web.branch('main', 'c9');
    const { graphs, session, requests } = setup(uniqueLogin(), world);
    // The stored user's check spends the last point.
    session.github.graphqlRemaining = 0;
    await session.clock.advance(0);
    expect(session.container.resolve(GitHubRateLimitStore).remaining('graphql')).toBe(0);

    await graphs.open('acme/web');
    await graphs.loadMore('acme/web');
    graphs.ensureStates('acme/web', ['c9']);
    await session.clock.advance(1000);

    expect(requests()).toEqual([]);
    expect(graphs.getFreshness('acme/web').kind).toBe('paused');
});

test('an answer arriving after the user signed out, or another signed in, is dropped', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.line('c', 0, 10);
    web.branch('main', 'c9');

    for (const change of ['signOut', 'switch'] as const) {
        const { graphs, session } = setup(uniqueLogin(), world);
        const held = createPromise();
        session.github.hold = held.promise;
        const opened = graphs.open('acme/web');
        await session.clock.advance(0);

        if (change === 'signOut') {
            session.signOutFromAnotherTab();
        } else {
            session.signInFromAnotherTab(uniqueLogin());
        }

        held.resolve();
        await opened;
        await session.clock.advance(0);

        expect(graphs.get('acme/web')).toBeUndefined();
        expect(graphs.getFreshness('acme/web')).toEqual({ kind: 'partial' });
    }
});

test("one repository's commits never show in another's, in memory or kept", async () => {
    const login = uniqueLogin();
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.line('w', 0, 5);
    web.branch('main', 'w4');
    const api = world.repository('acme/api');
    api.line('a', 0, 3);
    api.branch('main', 'a2');

    const before = setup(login, world);
    await Promise.all([before.graphs.open('acme/web'), before.graphs.open('acme/api')]);
    await before.session.clock.advance(0);

    expect(shownOids(before.graphs, 'acme/web')).toEqual(oids('w', 0, 5).toReversed());
    expect(shownOids(before.graphs, 'acme/api')).toEqual(oids('a', 0, 3).toReversed());
    expect(before.graphs.get('acme/api')?.commits.every(commit => commit.repository === 'acme/api')).toBe(true);

    const kept = await before.persistence.loadCommits(login, 'acme/api');
    expect(kept.commits.map(commit => commit.oid).toSorted()).toEqual(oids('a', 0, 3));
    expect(kept.refs?.repository).toBe('acme/api');
});

test('the state of the rows on screen is read in batches, used for a minute, and tells unknown from none', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.line('c', 0, 150);
    web.branch('main', 'c149');
    web.states.set('c149', {
        pullRequest: {
            number: 7,
            state: 'OPEN',
            title: 'Ship it',
            url: 'https://github.com/acme/web/pull/7',
            isDraft: false,
        },
        ci: 'FAILURE',
    });
    const { graphs, session, requests } = setup(uniqueLogin(), world);
    await graphs.open('acme/web');
    await graphs.loadMore('acme/web');
    const before = requests().length;

    // Two calls a moment apart go out together; over 100 commits take two requests.
    graphs.ensureStates('acme/web', oids('c', 0, 50));
    graphs.ensureStates('acme/web', oids('c', 50, 150));
    expect(graphs.getState('acme/web', 'c149')).toBeUndefined();
    await session.clock.advance(100);

    const asked = requests().slice(before);
    expect(asked.map(request => request.operation)).toEqual(['CommitStates', 'CommitStates']);
    expect(asked.map(request => idsOf(request).length)).toEqual([100, 50]);
    const shipped: CommitState = {
        pullRequest: {
            number: 7,
            state: 'OPEN',
            title: 'Ship it',
            url: 'https://github.com/acme/web/pull/7',
            isDraft: false,
        },
        ci: 'FAILURE',
    };
    expect(graphs.getState('acme/web', 'c149')).toEqual(shipped);
    const none: CommitState = { pullRequest: null, ci: null };
    expect(graphs.getState('acme/web', 'c3')).toEqual(none);
    // Another repository's commit of the same oid is not known.
    expect(graphs.getState('acme/api', 'c149')).toBeUndefined();

    graphs.ensureStates('acme/web', ['c149']);
    await session.clock.advance(100);
    expect(requests().length).toBe(before + 2);

    await session.clock.advance(60_000);
    graphs.ensureStates('acme/web', ['c149']);
    await session.clock.advance(100);
    expect(requests().slice(before + 2)).toEqual([{ operation: 'CommitStates', variables: { ids: ['C_c149'] } }]);
});

test('a first open draws the default branch at once, though its page of branches comes later', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.refsPerPage = 1;
    web.line('c', 0, 5);
    web.branch('main', 'c4');
    // Sorted before main, so the first page of branches does not hold it.
    web.branch('feature', 'c2');

    const { graphs, session } = setup(uniqueLogin(), world);
    const held = createPromise();
    session.github.holdIf = request => (request.variables.branchesAfter ? held.promise : null);
    const opened = graphs.open('acme/web');
    await session.clock.advance(0);

    expect(shownOids(graphs, 'acme/web')).toEqual(oids('c', 0, 5).toReversed());
    expect(graphs.get('acme/web')?.refs?.defaultBranch).toBe('main');
    expect(graphs.get('acme/web')?.refs?.branches.map(branch => branch.name)).toEqual(['feature', 'main']);

    held.resolve();
    await opened;

    // Its own page takes its place: it is listed once.
    expect(graphs.get('acme/web')?.refs?.branches.map(branch => branch.name)).toEqual(['feature', 'main']);
    expect(shownOids(graphs, 'acme/web')).toEqual(oids('c', 0, 5).toReversed());
});

test('the branches are joined as soon as they are read, without waiting for the remaining pages of tags', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.refsPerPage = 2;
    web.line('c', 0, 5);
    web.branch('main', 'c4');
    web.add('f1', 45, ['c3']);
    web.branch('feature', 'f1');
    web.tag('v1', 'c0');
    web.tag('v2', 'c1');
    web.tag('v3', 'c2');

    const { graphs, session, requests } = setup(uniqueLogin(), world);
    const held = createPromise();
    session.github.holdIf = request => (request.variables.tagsAfter ? held.promise : null);
    const opened = graphs.open('acme/web');
    await session.clock.advance(0);

    expect(requests().map(request => request.operation)).toContain('CommitHistories');
    expect(shownOids(graphs, 'acme/web')).toContain('f1');

    held.resolve();
    await opened;
    expect(graphs.get('acme/web')?.refs?.tags.map(tag => tag.name)).toEqual(['v1', 'v2', 'v3']);
});

test('a branch that could not be joined leaves the graph stale and not at its end, and the next open reads it', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.line('c', 0, 5);
    web.branch('main', 'c4');
    web.add('f1', 45, ['c3']);
    web.branch('feature', 'f1');

    let failing = true;
    const { graphs } = setup(uniqueLogin(), {
        answer: request => (failing && request.operation === 'CommitHistories' ? undefined : world.answer(request)),
    });
    await graphs.open('acme/web');

    expect(shownOids(graphs, 'acme/web')).not.toContain('f1');
    expect(graphs.getFreshness('acme/web').kind).toBe('stale');
    expect(graphs.get('acme/web')?.endReached).toBe(false);

    failing = false;
    await graphs.open('acme/web');

    expect(shownOids(graphs, 'acme/web')).toContain('f1');
    expect(graphs.getFreshness('acme/web').kind).toBe('fresh');
    expect(graphs.get('acme/web')?.endReached).toBe(true);
});

test('a reopen shows a branch that moved as soon as the branches are read, a page of tags still on its way', async () => {
    const login = uniqueLogin();
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.refsPerPage = 1;
    web.line('c', 0, 5);
    web.branch('main', 'c4');
    web.tag('v1', 'c0');
    web.tag('v2', 'c1');
    const before = setup(login, world);
    await before.graphs.open('acme/web');
    await before.session.clock.advance(0);

    web.add('c5', 50, ['c4']);
    web.branch('main', 'c5');
    const after = setup(login, world, before.persistence);
    const held = createPromise();
    after.session.github.holdIf = request => (request.variables.tagsAfter ? held.promise : null);
    const opened = after.graphs.open('acme/web');
    await after.session.clock.advance(0);

    expect(shownOids(after.graphs, 'acme/web')[0]).toBe('c5');
    expect(after.graphs.getFreshness('acme/web').kind).toBe('checking');
    expect(after.graphs.get('acme/web')?.refs?.tags.map(tag => tag.name)).toEqual(['v1', 'v2']);

    held.resolve();
    await opened;
    expect(after.graphs.getFreshness('acme/web').kind).toBe('fresh');
});

test('a page of tags that fails leaves the moved branch shown, the old tags and date kept, and the graph stale', async () => {
    const login = uniqueLogin();
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.refsPerPage = 1;
    web.line('c', 0, 5);
    web.branch('main', 'c4');
    web.tag('v1', 'c0');
    web.tag('v2', 'c1');
    const before = setup(login, world);
    await before.graphs.open('acme/web');
    await before.session.clock.advance(0);
    const since = before.graphs.get('acme/web')?.refs?.fetchedAt ?? null;

    web.add('c5', 50, ['c4']);
    web.branch('main', 'c5');
    web.tag('v0', 'c0');
    await before.session.clock.advance(1000);
    const after = setup(
        login,
        {
            answer: request => (request.variables.tagsAfter ? undefined : world.answer(request)),
        },
        before.persistence,
    );
    await after.graphs.open('acme/web');

    expect(shownOids(after.graphs, 'acme/web')[0]).toBe('c5');
    expect(after.graphs.get('acme/web')?.refs?.tags.map(tag => tag.name)).toEqual(['v1', 'v2']);
    const stale: Freshness = { kind: 'stale', since, reason: 'failing' };
    expect(after.graphs.getFreshness('acme/web')).toEqual(stale);
});

test('a first open is not at its end while a page of branches is unread, nor once one failed', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.refsPerPage = 1;
    web.line('c', 0, 5);
    web.branch('main', 'c4');
    web.branch('feature', 'c2');
    web.add('z1', 45, ['c3']);
    web.branch('zeta', 'z1');

    const { graphs, session } = setup(uniqueLogin(), {
        answer: request => (request.variables.branchesAfter === '2' ? undefined : world.answer(request)),
    });
    const held = createPromise();
    session.github.holdIf = request => (request.variables.branchesAfter === '1' ? held.promise : null);
    const opened = graphs.open('acme/web');
    await session.clock.advance(0);

    // All that is shown is loaded with no parent left to read, yet a branch is still to come.
    expect(shownOids(graphs, 'acme/web')).toEqual(oids('c', 0, 5).toReversed());
    expect(graphs.get('acme/web')?.endReached).toBe(false);

    held.resolve();
    await opened;
    expect(graphs.get('acme/web')?.endReached).toBe(false);
    expect(graphs.getFreshness('acme/web').kind).toBe('stale');
});

test('GitHub refusing a read for the rate pauses the graph until a minute from now, not stale, on the refs and the joining alike', async () => {
    for (const refused of ['RepositoryCommitRefs', 'CommitHistories']) {
        const world = fakeCommitGitHub();
        const web = world.repository('acme/web');
        web.line('c', 0, 5);
        web.branch('main', 'c4');
        web.add('f1', 45, ['c3']);
        web.branch('feature', 'f1');

        const { graphs, session } = setup(uniqueLogin(), {
            answer: request =>
                request.operation === refused
                    ? { data: null, errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }] }
                    : world.answer(request),
        });
        await graphs.open('acme/web');

        const freshness = graphs.getFreshness('acme/web');
        expect(freshness.kind).toBe('paused');
        expect(freshness.kind === 'paused' && freshness.until).toBe(session.clock.now() + 60_000);
    }
});

test('a refusal while the bucket is spent pauses until it resets', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.line('c', 0, 5);
    web.branch('main', 'c4');
    const { graphs, session } = setup(uniqueLogin(), {
        answer: () => ({ data: null, errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }] }),
    });
    session.github.graphqlRemaining = 0;
    await graphs.open('acme/web');

    const freshness = graphs.getFreshness('acme/web');
    const resetAt = session.container.resolve(GitHubRateLimitStore).get('graphql')?.resetAt.getTime();
    expect(freshness.kind === 'paused' && freshness.until).toBe(resetAt ?? -1);
});

test('opening a graph again reads its refs again, however soon', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.line('c', 0, 5);
    web.branch('main', 'c4');
    const { graphs, requests } = setup(uniqueLogin(), world);
    await graphs.open('acme/web');

    web.add('c5', 50, ['c4']);
    web.branch('main', 'c5');
    await graphs.open('acme/web');

    expect(requests().filter(request => request.operation === 'RepositoryCommitRefs')).toHaveLength(2);
    expect(shownOids(graphs, 'acme/web')[0]).toBe('c5');
});

function setup(login: string, world: Pick<FakeCommitGitHub, 'answer'>, persistence?: IndexedDbPersistence) {
    const session = createTestSession({ login, answer: request => world.answer(request) });
    const kept = setIndexedDbPersistence(session.container, persistence ?? createIndexedDbPersistence());
    // Opens the copy the commits are kept in.
    session.container.resolve(ItemStore);
    const graphs = session.container.resolve(CommitGraphStore);

    return {
        session,
        graphs,
        persistence: kept,
        /** The operations asked of GitHub, besides the stored user's check. */
        requests: () =>
            session.github.requests
                .filter(request => request.operation !== 'Viewer')
                .map(request => ({ operation: request.operation, variables: request.variables })),
    };
}

function shownOids(graphs: CommitGraphStore, nameWithOwner: string) {
    return graphs.get(nameWithOwner)?.commits.map(commit => commit.oid) ?? [];
}

/** `<prefix><from>` … `<prefix><to - 1>`. */
function oids(prefix: string, from: number, to: number) {
    const list: string[] = [];
    for (let i = from; i < to; i++) {
        list.push(`${prefix}${i}`);
    }

    return list;
}

function refsVariables(name: string, withHistory: boolean) {
    return {
        owner: 'acme',
        name,
        withHistory,
        withBranches: true,
        withTags: true,
        branchesAfter: null,
        tagsAfter: null,
    };
}

function idsOf(request: { readonly variables: Readonly<Record<string, unknown>> }): unknown[] {
    const ids = request.variables.ids;
    return Array.isArray(ids) ? ids : [];
}

function uniqueLogin() {
    return `user-${crypto.randomUUID()}`;
}
