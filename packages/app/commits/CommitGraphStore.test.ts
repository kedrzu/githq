/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import type { PullRequestCheckFieldsFragment } from '@githq/github/generated.gen.js';
import { createPromise } from '@nzyme/utils/createPromise.js';

import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { createIndexedDbPersistence } from '@/store/IndexedDbPersistence.js';
import type { IndexedDbPersistence } from '@/store/IndexedDbPersistence.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Freshness } from '@/sync/Freshness.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { fakeCommitGitHub } from '@/testing/fakeCommitGitHub.js';
import type { FakeCommitGitHub } from '@/testing/fakeCommitGitHub.js';
import { sampleCommit } from '@/testing/sampleCommits.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { CommitGraphStore } from './CommitGraphStore.js';
import type { CommitChecksRead, CommitGraphPlace, CommitState } from './CommitTypes.js';

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
    // D19: the status bar says the other branches are filling in.
    const filling: Freshness = { kind: 'filling', done: 0, total: 1 };
    expect(graphs.getFreshness('acme/web')).toEqual(filling);

    held.resolve();
    await opened;

    const fresh: Freshness = { kind: 'fresh', checkedAt: session.clock.now() };
    expect(graphs.getFreshness('acme/web')).toEqual(fresh);
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
    graphs.ensureStates('acme/web', [{ oid: 'c9', id: 'C_c9' }]);
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
    const commitsOf = (from: number, to: number) => oids('c', from, to).map(oid => ({ oid, id: `C_${oid}` }));
    graphs.ensureStates('acme/web', commitsOf(0, 50));
    graphs.ensureStates('acme/web', commitsOf(50, 150));
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

    graphs.ensureStates('acme/web', [{ oid: 'c149', id: 'C_c149' }]);
    await session.clock.advance(100);
    expect(requests().length).toBe(before + 2);

    await session.clock.advance(60_000);
    graphs.ensureStates('acme/web', [{ oid: 'c149', id: 'C_c149' }]);
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

test('CH40: coming back online reads a graph left offline again, and clears it; going offline asks nothing', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.line('c', 0, 5);
    web.branch('main', 'c4');
    let failing = true;
    const { graphs, session, requests } = setup(uniqueLogin(), {
        answer: request => (failing ? undefined : world.answer(request)),
    });
    session.setOnline(false);
    await graphs.open('acme/web');
    const offline: Freshness = { kind: 'stale', since: null, reason: 'offline' };
    expect(graphs.getFreshness('acme/web')).toEqual(offline);

    const asked = requests().length;
    session.setOnline(false);
    await session.clock.advance(0);
    expect(requests()).toHaveLength(asked);

    failing = false;
    session.setOnline(true);
    await session.clock.advance(0);
    expect(graphs.getFreshness('acme/web').kind).toBe('fresh');
    expect(shownOids(graphs, 'acme/web')).toEqual(oids('c', 0, 5).toReversed());
});

test('coming back online leaves a graph that failed for another reason alone', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.line('c', 0, 5);
    web.branch('main', 'c4');
    const { graphs, session, requests } = setup(uniqueLogin(), { answer: () => undefined });
    await graphs.open('acme/web');
    expect(graphs.getFreshness('acme/web')).toMatchObject({ kind: 'stale', reason: 'failing' });

    const asked = requests().length;
    session.setOnline(true);
    await session.clock.advance(0);
    expect(requests()).toHaveLength(asked);
});

test('a later good page clears what a failed one said, a failure and a pause alike', async () => {
    const refusal = { data: null, errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }] };
    for (const [failure, kind] of [
        [undefined, 'stale'],
        [refusal, 'paused'],
    ] as const) {
        const world = fakeCommitGitHub();
        const web = world.repository('acme/web');
        web.line('c', 0, 250);
        web.branch('main', 'c249');
        let failing = true;
        const { graphs } = setup(uniqueLogin(), {
            answer: request => (request.operation === 'CommitHistories' && failing ? failure : world.answer(request)),
        });
        await graphs.open('acme/web');
        await graphs.loadMore('acme/web');
        expect(graphs.getFreshness('acme/web').kind).toBe(kind);

        failing = false;
        await graphs.loadMore('acme/web');
        expect(shownOids(graphs, 'acme/web')).toHaveLength(200);
        expect(graphs.getFreshness('acme/web').kind).toBe('fresh');
    }
});

test("a good older page leaves another check's failure standing: the status bar stays stale", async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.refsPerPage = 1;
    web.line('c', 0, 250);
    web.branch('main', 'c249');
    web.tag('v1', 'c0');
    web.tag('v2', 'c1');
    const { graphs } = setup(uniqueLogin(), {
        answer: request => (request.variables.tagsAfter ? undefined : world.answer(request)),
    });
    await graphs.open('acme/web');
    const stale = graphs.getFreshness('acme/web');
    expect(stale).toMatchObject({ kind: 'stale', reason: 'failing' });

    await graphs.loadMore('acme/web');

    expect(shownOids(graphs, 'acme/web').length).toBeGreaterThan(100);
    expect(graphs.getFreshness('acme/web')).toEqual(stale);
});

test('coming back online reads a graph again when only its older page failed for want of the connection', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.line('c', 0, 250);
    web.branch('main', 'c249');
    let failing = true;
    const { graphs, session } = setup(uniqueLogin(), {
        answer: request => (request.operation === 'CommitHistories' && failing ? undefined : world.answer(request)),
    });
    await graphs.open('acme/web');
    session.setOnline(false);
    await graphs.loadMore('acme/web');
    expect(graphs.getFreshness('acme/web')).toMatchObject({ kind: 'stale', reason: 'offline' });

    failing = false;
    session.setOnline(true);
    await session.clock.advance(0);
    expect(graphs.getFreshness('acme/web').kind).toBe('fresh');
});

test('a reconnect during a running check reads the graph again once it ended, left offline', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.refsPerPage = 1;
    web.line('c', 0, 5);
    web.branch('main', 'c4');
    web.add('f1', 100, ['c3']);
    web.branch('feature', 'f1');
    web.tag('v1', 'c0');
    web.tag('v2', 'c1');
    let failing = true;
    const { graphs, session, requests } = setup(uniqueLogin(), {
        answer: request => (request.variables.tagsAfter && failing ? undefined : world.answer(request)),
    });
    const held = createPromise();
    session.github.holdIf = request => (request.operation === 'CommitHistories' ? held.promise : null);
    session.setOnline(false);
    const opened = graphs.open('acme/web');
    await session.clock.advance(0);

    // The page of tags failed for want of the connection, and the joining is still running: nothing to start yet.
    const asked = requests().filter(request => request.operation === 'RepositoryCommitRefs').length;
    failing = false;
    session.setOnline(true);
    await session.clock.advance(0);
    expect(requests().filter(request => request.operation === 'RepositoryCommitRefs')).toHaveLength(asked);

    held.resolve();
    await opened;
    await session.clock.advance(0);

    expect(requests().filter(request => request.operation === 'RepositoryCommitRefs').length).toBeGreaterThan(asked);
    expect(graphs.getFreshness('acme/web').kind).toBe('fresh');
});

test('a reconnect with the allowance spent does not spin on a graph left offline: nothing is asked', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.line('c', 0, 5);
    web.branch('main', 'c4');
    const { graphs, session, requests } = setup(uniqueLogin(), { answer: () => undefined });
    await session.clock.advance(0);
    session.setOnline(false);
    await graphs.open('acme/web');
    expect(graphs.getFreshness('acme/web')).toMatchObject({ kind: 'stale', reason: 'offline' });

    session.container.resolve(GitHubRateLimitStore).update({
        resource: 'graphql',
        limit: 5000,
        remaining: 0,
        resetAt: new Date(session.clock.now() + 60_000),
    });
    const asked = requests().length;
    session.setOnline(true);
    await session.clock.advance(0);

    expect(requests()).toHaveLength(asked);
    expect(graphs.getFreshness('acme/web').kind).toBe('paused');
});

test('D19: what is done stays done, though a merge at the bottom of a page leaves more to follow', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.line('c', 0, 120);
    web.branch('main', 'c119');
    web.add('near', 1191, ['c118']);
    web.branch('near', 'near');
    web.add('x', 1001, ['c100']);
    web.add('y', 1002, ['c100']);
    web.add('d0', 1003, ['x', 'y']);
    web.line('d', 1, 70, 1004);
    web.branch('deep', 'd69');
    const { graphs, session } = setup(uniqueLogin(), world);
    const held = createPromise();
    let histories = 0;
    session.github.holdIf = request => {
        if (request.operation !== 'CommitHistories') {
            return null;
        }

        // The third round: the first joined `near`, the second ended on the merge, with two parents to follow.
        histories++;
        return histories === 3 ? held.promise : null;
    };
    const opened = graphs.open('acme/web');
    await session.clock.advance(0);

    const filling: Freshness = { kind: 'filling', done: 1, total: 2 };
    expect(graphs.getFreshness('acme/web')).toEqual(filling);

    held.resolve();
    await opened;
});

test('a pause whose time has passed is no longer a pause', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.line('c', 0, 250);
    web.branch('main', 'c249');
    const { graphs, session } = setup(uniqueLogin(), {
        answer: request =>
            request.operation === 'CommitHistories'
                ? { data: null, errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }] }
                : world.answer(request),
    });
    await graphs.open('acme/web');
    await graphs.loadMore('acme/web');
    expect(graphs.getFreshness('acme/web').kind).toBe('paused');

    await session.clock.advance(60_001);
    session.github.holdIf = () => new Promise(() => {});
    void graphs.loadMore('acme/web');

    expect(graphs.get('acme/web')?.loadingMore).toBe(true);
    expect(graphs.getFreshness('acme/web').kind).toBe('fresh');
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

test("D13, D12: a commit's details are read once, by oid, and a commit not loaded never joins the graph", async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.add('old', 1, []);
    web.add('c1', 10, ['old']);
    web.add('c2', 20, ['c1']);
    web.branch('main', 'c2');
    web.tag('v0.1', 'old');
    web.bodies.set('old', 'Fixes the export.');
    const { graphs, session, requests } = setup(uniqueLogin(), world);
    session.github.holdIf = request => (request.operation === 'CommitHistories' ? new Promise(() => {}) : null);
    await graphs.open('acme/web');
    expect(graphs.getCommitPlace('acme/web', 'c2')).toBe('shown');
    const shown = shownOids(graphs, 'acme/web');
    const commit = { id: 'C_old', oid: 'old' };

    expect(graphs.getDetail('acme/web', 'old')).toBeUndefined();
    const before = graphs.getCommitPlace('acme/web', 'old');
    graphs.ensureDetail('acme/web', commit);
    expect(graphs.getDetail('acme/web', 'old')).toEqual({ kind: 'reading' });
    graphs.ensureDetail('acme/web', commit);
    await session.clock.advance(0);

    expect(graphs.getDetail('acme/web', 'old')).toMatchObject({
        kind: 'read',
        body: 'Fixes the export.',
        commit: { oid: 'old', headline: 'Commit old' },
    });
    expect(graphs.getCommit('acme/web', 'old')?.headline).toBe('Commit old');

    // Read again it is not asked for; and it stays out of the graph, as loaded as it was.
    graphs.ensureDetail('acme/web', commit);
    await session.clock.advance(0);
    expect(requests().filter(request => request.operation === 'CommitDetail')).toEqual([
        { operation: 'CommitDetail', variables: { id: 'C_old' } },
    ]);
    expect(shownOids(graphs, 'acme/web')).toEqual(shown);
    expect(graphs.getCommitPlace('acme/web', 'old')).toBe(before);
});

test('D13: a long subject GitHub cuts in the headline reads whole in the details, and only there, with nothing of it in the body', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    const cut = 'feat: render the list like vdom (#16…';
    web.commits.set('long', { ...sampleCommit('long', 10), headline: cut });
    web.subjects.set('long', 'feat: render the list like vdom (#16077)');
    web.bodies.set('long', 'Why it renders like that.\n');
    web.add('short', 20, ['long']);
    web.branch('main', 'short');
    const { graphs, session } = setup(uniqueLogin(), world);
    await graphs.open('acme/web');

    graphs.ensureDetail('acme/web', { id: 'C_long', oid: 'long' });
    graphs.ensureDetail('acme/web', { id: 'C_short', oid: 'short' });
    await session.clock.advance(0);

    expect(graphs.getDetail('acme/web', 'long')).toMatchObject({
        kind: 'read',
        headline: 'feat: render the list like vdom (#16077)',
        body: 'Why it renders like that.',
    });
    expect(graphs.getDetail('acme/web', 'short')).toMatchObject({ headline: 'Commit short', body: '' });
    expect(graphs.get('acme/web')?.commits.at(-1)?.headline).toBe(cut);
});

test('D12: a commit not loaded is asked for its state by its id, though neither its history nor a ref knows it', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.add('old', 1, []);
    web.add('c1', 10, ['old']);
    web.branch('main', 'c1');
    web.states.set('old', { pullRequest: null, ci: 'SUCCESS' });
    const { graphs, session } = setup(uniqueLogin(), world);
    session.github.holdIf = request => (request.operation === 'CommitHistories' ? new Promise(() => {}) : null);
    await graphs.open('acme/web');

    graphs.ensureStates('acme/web', [{ oid: 'old', id: 'C_old' }]);
    await session.clock.advance(100);

    expect(graphs.getState('acme/web', 'old')?.ci).toBe('SUCCESS');
});

test('D13, CH40: a read that fails says so and opening again asks again; with the allowance spent nothing is sent', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.add('c1', 10, []);
    web.branch('main', 'c1');
    const { graphs, session, requests } = setup(uniqueLogin(), {
        answer: request => (request.operation === 'CommitDetail' && failing ? undefined : world.answer(request)),
    });
    let failing = true;
    await graphs.open('acme/web');
    const commit = { id: 'C_c1', oid: 'c1' };

    graphs.ensureDetail('acme/web', commit);
    await session.clock.advance(0);
    expect(graphs.getDetail('acme/web', 'c1')).toEqual({ kind: 'failed' });

    failing = false;
    graphs.ensureDetail('acme/web', commit);
    await session.clock.advance(0);
    expect(graphs.getDetail('acme/web', 'c1')?.kind).toBe('read');

    const asked = requests().length;
    session.github.graphqlRemaining = 0;
    await graphs.open('acme/web');
    expect(session.container.resolve(GitHubRateLimitStore).remaining('graphql')).toBe(0);
    const after = requests().length;
    expect(after).toBeGreaterThan(asked);
    graphs.ensureDetail('acme/web', { id: 'C_other', oid: 'other' });
    await session.clock.advance(0);
    expect(requests()).toHaveLength(after);
    expect(graphs.getDetail('acme/web', 'other')).toEqual({ kind: 'failed' });
});

test('D13: details arriving after the user signed out, or another signed in, are dropped', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.add('c1', 10, []);
    web.branch('main', 'c1');

    for (const change of ['signOut', 'switch'] as const) {
        const { graphs, session } = setup(uniqueLogin(), world);
        await graphs.open('acme/web');
        const held = createPromise();
        session.github.hold = held.promise;
        graphs.ensureDetail('acme/web', { id: 'C_c1', oid: 'c1' });
        await session.clock.advance(0);

        if (change === 'signOut') {
            session.signOutFromAnotherTab();
        } else {
            session.signInFromAnotherTab(uniqueLogin());
        }

        held.resolve();
        await session.clock.advance(0);

        expect(graphs.getDetail('acme/web', 'c1')).toBeUndefined();
        expect(graphs.getCommit('acme/web', 'c1')).toBeUndefined();
    }
});

test('only the commit asked for has its checks read, once a minute, and a re-read leaves the last list in place', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.add('c1', 10, []);
    web.add('c2', 20, ['c1']);
    web.branch('main', 'c2');
    web.states.set('c1', { pullRequest: null, ci: 'SUCCESS' });
    web.states.set('c2', { pullRequest: null, ci: 'SUCCESS' });
    web.checks.set('c1', [checkRun('first')]);
    const { graphs, session, requests } = setup(uniqueLogin(), world);
    await graphs.open('acme/web');
    const commit = { id: 'C_c1', oid: 'c1' };

    // The rows ask for their state, never for their checks.
    graphs.ensureStates('acme/web', [commit, { id: 'C_c2', oid: 'c2' }]);
    await session.clock.advance(100);
    expect(checkReads(requests())).toEqual([]);

    expect(graphs.getChecks('acme/web', 'c1')).toBeUndefined();
    graphs.ensureChecks('acme/web', commit);
    await session.clock.advance(0);
    const first: CommitChecksRead = {
        kind: 'read',
        checks: [
            {
                id: 'CR_first',
                kind: 'checkRun',
                name: 'first',
                workflow: 'ci',
                state: 'passing',
                url: 'https://github.com/acme/web/actions/runs/1',
                startedAt: null,
                completedAt: null,
            },
        ],
        checkCount: 1,
        readAt: session.clock.now(),
    };
    expect(graphs.getChecks('acme/web', 'c1')).toEqual(first);
    expect(checkReads(requests())).toEqual([{ operation: 'CommitChecks', variables: { id: 'C_c1' } }]);

    await session.clock.advance(59_999);
    graphs.ensureChecks('acme/web', commit);
    await session.clock.advance(0);
    expect(checkReads(requests())).toHaveLength(1);

    await session.clock.advance(1);
    web.checks.set('c1', [checkRun('second')]);
    const held = createPromise();
    session.github.holdIf = request => (request.operation === 'CommitChecks' ? held.promise : null);
    graphs.ensureChecks('acme/web', commit);
    graphs.ensureChecks('acme/web', commit);
    await session.clock.advance(0);
    expect(graphs.getChecks('acme/web', 'c1')).toEqual(first);
    expect(checkReads(requests())).toHaveLength(2);

    held.resolve();
    await session.clock.advance(0);
    expect(graphs.getChecks('acme/web', 'c1')).toMatchObject({ checks: [{ name: 'second' }] });
});

test('a commit known to have no checks is not read, while one whose state is not known yet is', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.add('none', 10, []);
    web.add('unknown', 20, ['none']);
    web.branch('main', 'unknown');
    const { graphs, session, requests } = setup(uniqueLogin(), world);
    await graphs.open('acme/web');
    graphs.ensureStates('acme/web', [{ id: 'C_none', oid: 'none' }]);
    await session.clock.advance(100);
    expect(graphs.getState('acme/web', 'none')?.ci).toBeNull();

    graphs.ensureChecks('acme/web', { id: 'C_none', oid: 'none' });
    graphs.ensureChecks('acme/web', { id: 'C_unknown', oid: 'unknown' });
    await session.clock.advance(0);

    expect(checkReads(requests())).toEqual([{ operation: 'CommitChecks', variables: { id: 'C_unknown' } }]);
    expect(graphs.getChecks('acme/web', 'none')).toBeUndefined();
    expect(graphs.getChecks('acme/web', 'unknown')).toMatchObject({ kind: 'read', checks: [], checkCount: 0 });
});

test('a failed read of checks is not repeated for a minute, and a failed re-read keeps the list', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.add('c1', 10, []);
    web.branch('main', 'c1');
    web.checks.set('c1', [checkRun('first')]);
    let failing = true;
    const { graphs, session, requests } = setup(uniqueLogin(), {
        answer: request => (request.operation === 'CommitChecks' && failing ? undefined : world.answer(request)),
    });
    await graphs.open('acme/web');
    const commit = { id: 'C_c1', oid: 'c1' };

    graphs.ensureChecks('acme/web', commit);
    await session.clock.advance(0);
    const failed: CommitChecksRead = { kind: 'failed', readAt: session.clock.now() };
    expect(graphs.getChecks('acme/web', 'c1')).toEqual(failed);
    graphs.ensureChecks('acme/web', commit);
    await session.clock.advance(0);
    expect(checkReads(requests())).toHaveLength(1);

    await session.clock.advance(60_000);
    failing = false;
    graphs.ensureChecks('acme/web', commit);
    await session.clock.advance(0);
    expect(graphs.getChecks('acme/web', 'c1')).toMatchObject({ kind: 'read' });
    expect(checkReads(requests())).toHaveLength(2);

    await session.clock.advance(60_000);
    failing = true;
    graphs.ensureChecks('acme/web', commit);
    await session.clock.advance(0);
    expect(graphs.getChecks('acme/web', 'c1')).toMatchObject({
        kind: 'read',
        checks: [{ name: 'first' }],
    });
    expect(checkReads(requests())).toHaveLength(3);

    await session.clock.advance(59_999);
    graphs.ensureChecks('acme/web', commit);
    await session.clock.advance(0);
    expect(checkReads(requests())).toHaveLength(3);
});

test('checks arriving after the user signed out, or another signed in, are dropped', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.add('c1', 10, []);
    web.branch('main', 'c1');

    for (const change of ['signOut', 'switch'] as const) {
        const { graphs, session } = setup(uniqueLogin(), world);
        await graphs.open('acme/web');
        const held = createPromise();
        session.github.hold = held.promise;
        graphs.ensureChecks('acme/web', { id: 'C_c1', oid: 'c1' });
        await session.clock.advance(0);

        if (change === 'signOut') {
            session.signOutFromAnotherTab();
        } else {
            session.signInFromAnotherTab(uniqueLogin());
        }

        held.resolve();
        await session.clock.advance(0);

        expect(graphs.getChecks('acme/web', 'c1')).toBeUndefined();
    }
});

test('with the allowance spent no checks are asked for: an earlier list stays, and with none the read says it failed', async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.add('c1', 10, []);
    web.add('c2', 20, ['c1']);
    web.branch('main', 'c2');
    const { graphs, session, requests } = setup(uniqueLogin(), world);
    await graphs.open('acme/web');
    graphs.ensureChecks('acme/web', { id: 'C_c1', oid: 'c1' });
    await session.clock.advance(0);
    const read = graphs.getChecks('acme/web', 'c1');
    expect(read?.kind).toBe('read');

    session.github.graphqlRemaining = 0;
    await graphs.open('acme/web');
    expect(session.container.resolve(GitHubRateLimitStore).remaining('graphql')).toBe(0);
    await session.clock.advance(60_000);
    graphs.ensureChecks('acme/web', { id: 'C_c1', oid: 'c1' });
    graphs.ensureChecks('acme/web', { id: 'C_c2', oid: 'c2' });
    await session.clock.advance(0);

    expect(checkReads(requests())).toHaveLength(1);
    expect(graphs.getChecks('acme/web', 'c1')).toEqual(read);
    const failed: CommitChecksRead = { kind: 'failed', readAt: session.clock.now() };
    expect(graphs.getChecks('acme/web', 'c2')).toEqual(failed);
});

test("a place left for a run's page comes back once, in its own repository, and to no other account", () => {
    const place: CommitGraphPlace = { cursorOid: 'c2', opened: { oid: 'c1', id: 'C_c1', chosenRef: null } };

    const { graphs, session } = setup(uniqueLogin(), fakeCommitGitHub());
    graphs.setPlace('acme/web', place);
    expect(graphs.takePlace('acme/other')).toBeUndefined();
    expect(graphs.takePlace('acme/web')).toEqual(place);
    expect(graphs.takePlace('acme/web')).toBeUndefined();

    graphs.setPlace('acme/web', place);
    session.signInFromAnotherTab(uniqueLogin());
    expect(graphs.takePlace('acme/web')).toBeUndefined();

    graphs.setPlace('acme/web', place);
    session.signOutFromAnotherTab();
    expect(graphs.takePlace('acme/web')).toBeUndefined();
});

test("a force-pushed branch's old commit stays known, and stands as gone from the graph", async () => {
    const world = fakeCommitGitHub();
    const web = world.repository('acme/web');
    web.add('base', 1, []);
    web.add('old', 10, ['base']);
    web.add('new', 11, ['base']);
    web.branch('main', 'old');
    const { graphs } = setup(uniqueLogin(), world);
    await graphs.open('acme/web');
    expect(graphs.getCommitPlace('acme/web', 'old')).toBe('shown');

    web.branch('main', 'new');
    await graphs.open('acme/web');

    expect(graphs.getCommitPlace('acme/web', 'old')).toBe('gone');
    expect(graphs.getCommit('acme/web', 'old')?.headline).toBe('Commit old');
    expect(graphs.getCommitPlace('acme/web', 'never')).toBe('notLoaded');
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

/** The `CommitChecks` reads among the operations asked of GitHub. */
function checkReads<T extends { readonly operation: string }>(requests: readonly T[]) {
    return requests.filter(request => request.operation === 'CommitChecks');
}

function checkRun(name: string): PullRequestCheckFieldsFragment {
    return {
        __typename: 'CheckRun',
        id: `CR_${name}`,
        name,
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
        detailsUrl: 'https://github.com/acme/web/actions/runs/1',
        startedAt: null,
        completedAt: null,
        checkSuite: { workflowRun: { workflow: { name: 'ci' } } },
    };
}

function uniqueLogin() {
    return `user-${crypto.randomUUID()}`;
}
