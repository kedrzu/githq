/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type {
    IssueFieldsFragment,
    PullRequestFieldsFragment,
    PullRequestStatusFieldsFragment,
} from '@githq/github/generated.gen.js';
import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';
import { createTestContainer } from '@nzyme/ioc-testing/createTestContainer.js';
import { mapNotNull } from '@nzyme/utils/array/mapNotNull.js';
import { assert } from '@nzyme/utils/assert.js';
import { createPromise } from '@nzyme/utils/createPromise.js';

import { AuthStore, VIEWER_KEY } from '@/auth/AuthStore.js';
import { TOKEN_KEY } from '@/auth/TokenVault.js';
import type { BrowserShape } from '@/services/Browser.js';
import { Browser } from '@/services/Browser.js';
import type { ClockShape } from '@/services/Clock.js';
import { Clock } from '@/services/Clock.js';
import { createTestTabs } from '@/testing/createTestTabs.js';
import type { TestTabs } from '@/testing/createTestTabs.js';
import { fakeOnline } from '@/testing/fakeOnline.js';
import { sampleIssue, samplePullRequest } from '@/testing/sampleItems.js';
import { ProjectPersistence } from '@/projects/ProjectPersistence.js';
import { RepositoryHolds } from '@/repos/RepositoryHolds.js';
import type { PersistedItems } from '@/store/ItemPersistence.js';
import { ItemPersistence } from '@/store/ItemPersistence.js';
import { ItemStore } from '@/store/ItemStore.js';
import { MY_WORK_GROUPS } from '@/store/ItemStoreTypes.js';
import type { MyWorkGroup } from '@/store/ItemStoreTypes.js';
import { toItem } from '@/store/toItem.js';
import { settle } from '@/testing/settle.js';
import { TrackingPersistence } from '@/tracking/TrackingPersistence.js';
import type { RepositorySyncState } from '@/tracking/TrackingTypes.js';
import { WorkflowPersistence } from '@/workflows/WorkflowPersistence.js';

import type { Freshness } from './Freshness.js';
import type { SyncNotice } from './SyncEngine.js';
import { EDIT_RESERVE } from './getAllowancePause.js';
import { SyncEngine } from './SyncEngine.js';

const START = Date.UTC(2026, 9, 30, 13, 0, 0);
const MONDAY = '2026-10-26T10:00:00Z';
const TUESDAY = '2026-10-27T10:00:00Z';
const WEDNESDAY = '2026-10-28T10:00:00Z';

const DRAFT = { id: 'PRR_1', createdAt: MONDAY, comments: { totalCount: 2 } };

const REPOSITORY: IssueFieldsFragment['repository'] = {
    nameWithOwner: 'acme/web',
    isPrivate: false,
    viewerPermission: 'WRITE',
    owner: { login: 'acme' },
};

/** The kept settings of a user who tracks `acme/web`, as `TrackingStore` keeps them in `localStorage`. */
const TRACKING_SLOT = JSON.stringify({
    chosen: true,
    document: { version: 1, repositories: [{ nameWithOwner: 'acme/web', id: 'R_1', tracking: true }], projects: [] },
});

const TRACKED_SYNC_STATE: RepositorySyncState = {
    kind: 'repository',
    nameWithOwner: 'acme/web',
    phase: 'done',
    cursor: null,
    counts: {},
    since: MONDAY,
    etag: null,
    hidden: false,
    refused: null,
    lastSuccessAt: null,
};

const QUERIES: Record<MyWorkGroup, string> = {
    reviewRequested: 'is:open is:pr review-requested:@me archived:false',
    authored: 'is:open is:pr author:@me archived:false',
    assigned: 'is:open is:issue assignee:@me archived:false',
    mentioned: 'is:open mentions:@me archived:false',
};

test('a poll runs the four searches, re-reads only new or changed items, drops deleted ones, and an item no search finds leaves my work and the local copy', async () => {
    const github = fakeGitHub();
    github.found.assigned = [issueNode('I_1', MONDAY), issueNode('I_9', MONDAY)];
    github.found.authored = [pullRequestNode('PR_1', MONDAY)];
    // Deleted between the search and the re-read.
    github.deleted.add('I_9');
    const { items, clock } = await setup(github, 'alice');

    expect(github.searches()).toEqual([QUERIES.reviewRequested, QUERIES.authored, QUERIES.assigned, QUERIES.mentioned]);
    // Each group's new items are read as its search answers.
    expect(github.graphql('ItemsByIds')).toEqual([['PR_1'], ['I_1', 'I_9']]);
    expect(items.get('I_1')?.updatedAt).toBe(MONDAY);
    expect(items.get('I_9')).toBeUndefined();
    expect(items.membership.assigned).toEqual(new Set(['I_1']));
    expect(items.membership.authored).toEqual(new Set(['PR_1']));

    // Nothing moved (and the search caught up with the deletion): searched again, nothing re-read.
    github.found.assigned = [issueNode('I_1', MONDAY)];
    github.requests.length = 0;
    await clock.advance(30_000);
    expect(github.searches()).toHaveLength(4);
    expect(github.graphql('ItemsByIds')).toEqual([]);

    // The issue was edited, then unassigned: it is re-read only when it moved, and leaves when no search has it.
    github.found.assigned = [issueNode('I_1', TUESDAY)];
    await clock.advance(30_000);
    expect(github.graphql('ItemsByIds')).toEqual([['I_1']]);
    expect(items.get('I_1')?.updatedAt).toBe(TUESDAY);

    // Mentioned too: unassigned, it stays for the mention.
    github.found.mentioned = [issueNode('I_1', TUESDAY)];
    github.found.assigned = [];
    await clock.advance(30_000);
    expect(items.membership.assigned).toEqual(new Set());
    expect(items.get('I_1')?.updatedAt).toBe(TUESDAY);

    // In no group any more: it leaves the local copy; the pull request, still mine, stays.
    github.found.mentioned = [];
    await clock.advance(30_000);
    expect(items.membership.mentioned).toEqual(new Set());
    expect(items.get('I_1')).toBeUndefined();
    expect(items.get('PR_1')?.updatedAt).toBe(MONDAY);
});

test('an item GitHub will not show, or shows without a field it refuses, does not stop the poll', async () => {
    const github = fakeGitHub();
    const hidden = issueNode('I_hidden', MONDAY);
    github.found.assigned = [issueNode('I_1', MONDAY), hidden];
    // In an organisation with OAuth App restrictions: its project's place comes back `null`, the rest is there.
    github.found.authored = [{ ...pullRequestNode('PR_1', MONDAY), projectItems: { nodes: [null] } }];
    github.forbiddenProject.set('PR_1', 0);
    const { items, clock } = await setup(github, 'alice');

    expect(items.get('PR_1')).toMatchObject({ kind: 'pullRequest', projects: [] });
    expect(items.membership.authored).toEqual(new Set(['PR_1']));
    expect(items.get('I_hidden')?.updatedAt).toBe(MONDAY);

    // Changed, but now hidden behind a restriction: the kept copy stays, and the poll still succeeds.
    github.found.assigned = [issueNode('I_1', MONDAY), { ...hidden, updatedAt: TUESDAY }];
    github.refused.set('I_hidden', {
        type: 'FORBIDDEN',
        message: 'Resource protected by organization SAML enforcement.',
    });
    await clock.advance(30_000);

    expect(items.get('I_hidden')?.updatedAt).toBe(MONDAY);
    expect(items.membership.assigned).toEqual(new Set(['I_1', 'I_hidden']));
    expect(items.getSyncState('myWork')).toMatchObject({ lastSuccessAt: START + 30_000, lastError: null });
});

test('each group is written as its search answers: one that fails leaves the others in place', async () => {
    const github = fakeGitHub();
    github.found.reviewRequested = [pullRequestNode('PR_review', MONDAY)];
    github.found.authored = [pullRequestNode('PR_1', MONDAY)];
    github.found.assigned = [issueNode('I_1', MONDAY)];
    github.failSearch = 'assigned';
    const { items } = await setup(github, 'alice');

    expect(items.membership).toEqual({
        reviewRequested: new Set(['PR_review']),
        authored: new Set(['PR_1']),
        mentioned: new Set(),
    });
    expect(items.get('PR_1')?.updatedAt).toBe(MONDAY);
    expect(items.getSyncState('myWork')).toMatchObject({ lastSuccessAt: null, lastError: expect.any(String) });
});

test('"Try again" polls my work at once: it tells failing until the search answers, then what arrived', async () => {
    const github = fakeGitHub();
    github.found.assigned = [issueNode('I_1', MONDAY)];
    github.failSearch = 'assigned';
    const { items, sync } = await setup(github, 'alice');
    expect(sync.myWorkFreshness).toEqual({ kind: 'stale', since: null, reason: 'failing' });

    await sync.pollNow(['myWork']);
    expect(sync.myWorkFreshness).toEqual({ kind: 'stale', since: null, reason: 'failing' });

    github.failSearch = null;
    await sync.pollNow(['myWork']);
    expect(items.membership.assigned).toEqual(new Set(['I_1']));
    expect(sync.myWorkFreshness.kind).toBe('fresh');
});

test('"Try again" in a tab that does not sync has the syncing tab poll my work', async () => {
    const github = fakeGitHub();
    github.failSearch = 'assigned';
    const tabs = createTestTabs();
    const syncing = await setup(github, 'alice', { tabs });
    const browsing = await setup(github, 'alice', { tabs });
    const searches = github.searches().length;

    await browsing.sync.pollNow(['myWork']);
    await syncing.clock.advance(0);
    expect(github.searches().length).toBeGreaterThan(searches);
});

test('the download waits for my work, so my work failing tells on what it has yet to read, and "Try again" asks it again', async () => {
    const github = fakeGitHub();
    github.failSearch = 'assigned';
    const { sync } = await setup(github, 'alice');
    expect(sync.getRepositoryFreshness('acme/web')).toEqual({ kind: 'stale', since: null, reason: 'failing' });

    // What it waits for is what "Try again" asks.
    expect(sync.getRepositoryLoop('acme/web')).toBe('myWork');
    const searches = github.searches().length;
    github.failSearch = null;
    await sync.pollNow([sync.getRepositoryLoop('acme/web')]);
    expect(github.searches().length).toBeGreaterThan(searches);
    expect(sync.getRepositoryFreshness('acme/web').kind).toBe('partial');
});

test('"Try again" on a tracked repository in a tab that does not sync has the syncing tab poll', async () => {
    const github = fakeGitHub();
    github.failSearch = 'assigned';
    const tabs = createTestTabs();
    const syncing = await setup(github, 'alice', { tabs });
    const browsing = await setup(github, 'alice', { tabs });
    const searches = github.searches().length;

    await browsing.sync.pollNow([browsing.sync.getRepositoryLoop('acme/web')]);
    await syncing.clock.advance(0);
    expect(github.searches().length).toBeGreaterThan(searches);
});

test('an item two groups hold, found deleted by the read of one, leaves both', async () => {
    const github = fakeGitHub();
    github.found.authored = [pullRequestNode('PR_9', MONDAY)];
    github.found.mentioned = [pullRequestNode('PR_9', MONDAY), issueNode('I_1', MONDAY)];
    github.deleted.add('PR_9');
    const { items } = await setup(github, 'alice');

    expect(items.membership.authored).toEqual(new Set());
    expect(items.membership.mentioned).toEqual(new Set(['I_1']));
});

test('the open pull requests of my work get their status re-read, without the rest of the item', async () => {
    const github = fakeGitHub();
    github.found.authored = [pullRequestNode('PR_1', MONDAY)];
    const { items, clock } = await setup(github, 'alice');
    github.requests.length = 0;

    github.statuses.set('PR_1', { ...pullRequestNode('PR_1', MONDAY), reviewDecision: 'APPROVED' });
    await clock.advance(60_000);

    expect(github.graphql('PullRequestStatuses')).toEqual([['PR_1']]);
    expect(items.get('PR_1')).toMatchObject({ kind: 'pullRequest', reviewDecision: 'APPROVED', updatedAt: MONDAY });
});

test('a pull request removed while its status is on its way does not come back, and the others still get theirs', async () => {
    const github = fakeGitHub();
    github.found.authored = [pullRequestNode('PR_gone', MONDAY), pullRequestNode('PR_1', MONDAY)];
    const { items, clock } = await setup(github, 'alice');

    const held = createPromise();
    github.hold = held.promise;
    github.statuses.set('PR_1', { ...pullRequestNode('PR_1', MONDAY), reviewDecision: 'APPROVED' });
    await clock.advance(60_000);
    expect(github.graphql('PullRequestStatuses').at(-1)).toEqual(['PR_gone', 'PR_1']);

    // Another loop or tab found it gone meanwhile.
    items.remove(['PR_gone']);
    github.hold = null;
    held.resolve();
    await clock.advance(0);

    expect(items.get('PR_gone')).toBeUndefined();
    expect(items.get('PR_1')).toMatchObject({ reviewDecision: 'APPROVED' });
    expect(items.getSyncState('pullRequestStatuses').lastError).toBeNull();
});

test('a pull request closed with a draft review stays and is re-read while the draft does; with the draft gone it goes, unless something else keeps it', async () => {
    const github = fakeGitHub();
    const pendingReviews = { nodes: [{ id: 'PRR_1', createdAt: MONDAY, comments: { totalCount: 2 } }] };
    const left = { ...pullRequestNode('PR_1', MONDAY), pendingReviews };
    const stays = { ...pullRequestNode('PR_2', MONDAY), pendingReviews };
    github.found.authored = [left, stays];
    const { items, clock } = await setup(github, 'alice');

    // Closed: the `is:open` searches no longer find it.
    const closed: PullRequestFieldsFragment = { ...left, state: 'CLOSED' };
    github.found.authored = [stays];
    github.statuses.set('PR_1', closed);
    github.requests.length = 0;
    await clock.advance(60_000);

    expect(github.graphql('PullRequestStatuses')).toEqual([['PR_2', 'PR_1']]);
    expect(items.membership.authored).toEqual(new Set(['PR_2']));
    expect(items.get('PR_1')).toMatchObject({ state: 'CLOSED', pendingReview: { commentCount: 2 } });

    github.statuses.set('PR_1', { ...closed, pendingReviews: { nodes: [] } });
    github.statuses.set('PR_2', { ...stays, pendingReviews: { nodes: [] } });
    await clock.advance(60_000);

    expect(items.get('PR_1')).toBeUndefined();
    expect(items.get('PR_2')).toMatchObject({ pendingReview: null });

    github.requests.length = 0;
    await clock.advance(60_000);
    expect(github.graphql('PullRequestStatuses')).toEqual([['PR_2']]);
});

test('a draft review kept after its pull request left my work keeps its stack, read once, until the draft is gone', async () => {
    const github = fakeGitHub();
    const pendingReviews = { nodes: [{ id: 'PRR_1', createdAt: MONDAY, comments: { totalCount: 2 } }] };
    const mine = { ...stackedNode('PR_2', 2, 3), pendingReviews };
    github.found.reviewRequested = [mine];
    github.stacks.set('ST_1', [stackedNode('PR_1', 1, 3, 'MERGED'), mine, stackedNode('PR_3', 3, 3)]);
    const { items, clock } = await setup(github, 'alice');

    // The request for the review withdrawn.
    github.found.reviewRequested = [];
    github.requests.length = 0;
    await clock.advance(60_000);

    expect(github.graphql('PullRequestStacks')).toEqual([]);
    expect(items.all.map(item => item.id).toSorted()).toEqual(['PR_1', 'PR_2', 'PR_3']);

    github.statuses.set('PR_2', { ...mine, pendingReviews: { nodes: [] } });
    await clock.advance(60_000);

    expect(items.all).toEqual([]);
    expect(github.graphql('PullRequestStacks')).toEqual([]);
});

test('a pull request kept for its draft review alone, found deleted by the next read of the statuses, goes', async () => {
    const github = fakeGitHub();
    const draft = {
        ...pullRequestNode('PR_1', MONDAY),
        pendingReviews: { nodes: [{ id: 'PRR_1', createdAt: MONDAY, comments: { totalCount: 2 } }] },
    };
    github.found.authored = [draft];
    const { items, clock } = await setup(github, 'alice');

    github.found.authored = [];
    await clock.advance(60_000);
    expect(items.get('PR_1')).toMatchObject({ pendingReview: { commentCount: 2 } });

    github.deleted.add('PR_1');
    await clock.advance(60_000);
    expect(items.get('PR_1')).toBeUndefined();
});

test('a pull request of a stack brings the rest of the stack, merged ones too, read once; a stack held whole costs nothing more', async () => {
    const github = fakeGitHub();
    const mine = stackedNode('PR_2', 2, 3);
    github.found.reviewRequested = [mine];
    github.stacks.set('ST_1', [stackedNode('PR_1', 1, 3, 'MERGED'), mine, stackedNode('PR_3', 3, 3)]);
    const { items, clock } = await setup(github, 'alice');

    expect(github.graphql('PullRequestStacks')).toEqual([['ST_1']]);
    expect(items.get('PR_1')).toMatchObject({ state: 'MERGED', stack: { id: 'ST_1', position: 1, size: 3 } });
    expect(items.get('PR_3')).toMatchObject({ state: 'OPEN', stack: { id: 'ST_1', position: 3, size: 3 } });
    expect(items.membership.reviewRequested).toEqual(new Set(['PR_2']));

    // Whole now: the stack is not asked again.
    github.requests.length = 0;
    await clock.advance(60_000);
    expect(github.graphql('PullRequestStacks')).toEqual([]);

    // A fourth pull request stacked on top: the size the statuses bring says one is missing, so it is read again.
    const grown = [stackedNode('PR_1', 1, 4, 'MERGED'), stackedNode('PR_2', 2, 4), stackedNode('PR_3', 3, 4)];
    github.stacks.set('ST_1', [...grown, stackedNode('PR_4', 4, 4)]);
    for (const node of grown) {
        github.statuses.set(node.id, node);
    }

    await clock.advance(60_000);
    expect(github.graphql('PullRequestStacks')).toEqual([['ST_1']]);
    expect(items.get('PR_4')).toMatchObject({ stack: { id: 'ST_1', position: 4, size: 4 } });
});

test('the open pull requests copied for their stack get their status re-read too, the merged ones not', async () => {
    const github = fakeGitHub();
    const mine = stackedNode('PR_2', 2, 3);
    github.found.authored = [mine];
    github.stacks.set('ST_1', [stackedNode('PR_1', 1, 3, 'MERGED'), mine, stackedNode('PR_3', 3, 3)]);
    const { items, clock } = await setup(github, 'alice');
    github.requests.length = 0;

    github.statuses.set('PR_3', { ...stackedNode('PR_3', 3, 3), reviewDecision: 'APPROVED' });
    await clock.advance(60_000);

    expect(github.graphql('PullRequestStatuses')).toEqual([['PR_2', 'PR_3']]);
    expect(items.get('PR_3')).toMatchObject({ kind: 'pullRequest', reviewDecision: 'APPROVED' });
});

test('a pull request copied for its stack stays while another of the stack is in my work, and goes with the last', async () => {
    const github = fakeGitHub();
    const mine = stackedNode('PR_2', 2, 3);
    github.found.reviewRequested = [mine];
    github.stacks.set('ST_1', [stackedNode('PR_1', 1, 3, 'MERGED'), mine, stackedNode('PR_3', 3, 3)]);
    const { items, clock } = await setup(github, 'alice');

    // My work polled again, dropping what nothing keeps: the stack stays with the one I review.
    await clock.advance(30_000);
    expect(items.get('PR_1')).toBeDefined();
    expect(items.get('PR_3')).toBeDefined();

    // My review is no longer asked: the whole stack goes.
    github.found.reviewRequested = [];
    await clock.advance(30_000);
    expect(items.get('PR_1')).toBeUndefined();
    expect(items.get('PR_2')).toBeUndefined();
    expect(items.get('PR_3')).toBeUndefined();
});

test('a stack only browsed is asked about by no loop, while the stacks of my work still are', async () => {
    const github = fakeGitHub();
    const mine = stackedNode('PR_2', 2, 3);
    github.found.authored = [mine];
    github.stacks.set('ST_1', [stackedNode('PR_1', 1, 3, 'MERGED'), mine, stackedNode('PR_3', 3, 3)]);
    const { items, clock, holds } = await setup(github, 'alice');

    holds.hold('octo/browsed');
    const repository = { ...samplePullRequest('PR_browsed').repository, nameWithOwner: 'octo/browsed', owner: 'octo' };
    // Open, one of three: as read by a screen, it would be polled and its stack read whole if it were synced.
    items.upsertMany([
        {
            ...samplePullRequest('PR_browsed'),
            repository,
            stack: { id: 'ST_browsed', number: 7, position: 1, size: 3 },
        },
    ]);
    github.requests.length = 0;

    // A pull request stacked on top of mine: my stack is read again, the browsed one not.
    const grown = [stackedNode('PR_1', 1, 4, 'MERGED'), stackedNode('PR_2', 2, 4), stackedNode('PR_3', 3, 4)];
    github.stacks.set('ST_1', [...grown, stackedNode('PR_4', 4, 4)]);
    for (const node of grown) {
        github.statuses.set(node.id, node);
    }

    await clock.advance(60_000);

    expect(github.graphql('PullRequestStatuses')).toEqual([['PR_2', 'PR_3']]);
    expect(github.graphql('PullRequestStacks')).toEqual([['ST_1']]);
    expect(github.requests.filter(request => request.ids.includes('PR_browsed'))).toEqual([]);
    expect(items.get('PR_browsed')).toMatchObject({ stack: { id: 'ST_browsed' } });
});

test("my work's clean-up leaves the rows another tab holds, and takes those nothing else keeps once it is gone", async () => {
    const github = fakeGitHub();
    github.found.authored = [pullRequestNode('PR_mine', MONDAY)];
    const tabs = createTestTabs();
    const syncing = await setup(github, 'alice', { tabs });
    const browsing = await setup(github, 'alice', { tabs });

    // In another case than the row's repository: GitHub does not care, and a typed address may not either.
    browsing.holds.hold('ACME/Web');
    browsing.items.upsertMany([sampleIssue('I_browsed')]);
    await syncing.clock.advance(30_000);

    expect(syncing.items.get('I_browsed')?.id).toBe('I_browsed');
    expect(browsing.items.get('I_browsed')?.id).toBe('I_browsed');

    browsing.tab.close();
    await syncing.clock.advance(30_000);

    expect(syncing.items.get('I_browsed')).toBeUndefined();
    expect(syncing.items.get('PR_mine')?.id).toBe('PR_mine');
});

test("my work's clean-up takes a released repository's rows only when its hold is over, and those in my work stay", async () => {
    const github = fakeGitHub();
    github.found.authored = [pullRequestNode('PR_mine', MONDAY)];
    const { items, clock, holds } = await setup(github, 'alice');

    const release = holds.hold('acme/web');
    items.upsertMany([sampleIssue('I_browsed')]);
    release();
    await clock.advance(599_000);
    expect(items.get('I_browsed')?.id).toBe('I_browsed');

    await clock.advance(31_000);
    expect(items.get('I_browsed')).toBeUndefined();
    expect(items.get('PR_mine')?.id).toBe('PR_mine');
    expect(items.membership.authored).toEqual(new Set(['PR_mine']));
});

test('a held pull request a stack read no longer lists has left the stack, and the stack is not asked again', async () => {
    const github = fakeGitHub();
    const mine = stackedNode('PR_4', 4, 4);
    github.found.reviewRequested = [mine];
    github.stacks.set('ST_1', [
        stackedNode('PR_1', 1, 4, 'MERGED'),
        stackedNode('PR_2', 2, 4, 'CLOSED'),
        stackedNode('PR_3', 3, 4),
        mine,
    ]);
    const { items, clock } = await setup(github, 'alice');
    expect(items.get('PR_2')).toMatchObject({ state: 'CLOSED', stack: { id: 'ST_1', position: 2, size: 4 } });
    // "My work" held from here on, so nothing drops what the stack no longer keeps — as a tracked repository would
    // keep its closed pull request.
    github.holdSearch = createPromise().promise;

    // The closed one taken out of the stack, which moves no `updated_at`: only the open ones' statuses say so.
    const left = [stackedNode('PR_1', 1, 3, 'MERGED'), stackedNode('PR_3', 2, 3), stackedNode('PR_4', 3, 3)];
    github.stacks.set('ST_1', left);
    for (const node of left) {
        github.statuses.set(node.id, node);
    }

    github.requests.length = 0;
    await clock.advance(60_000);
    expect(github.graphql('PullRequestStacks')).toEqual([['ST_1']]);
    expect(items.get('PR_2')).toMatchObject({ state: 'CLOSED', stack: null });
    expect(items.get('PR_1')).toMatchObject({ stack: { id: 'ST_1', position: 1, size: 3 } });

    github.requests.length = 0;
    await clock.advance(60_000);
    expect(github.graphql('PullRequestStacks')).toEqual([]);
});

test('a closed pull request the stack linked anew left is read out of it, though the stack holds every place', async () => {
    const github = fakeGitHub();
    const mine = stackedNode('PR_2', 2, 3);
    github.found.reviewRequested = [mine];
    github.stacks.set('ST_1', [stackedNode('PR_1', 1, 3, 'CLOSED'), mine, stackedNode('PR_3', 3, 3)]);
    const { items, clock } = await setup(github, 'alice');
    expect(items.get('PR_1')).toMatchObject({ state: 'CLOSED', stack: { id: 'ST_1', position: 1, size: 3 } });

    // The closed first one dropped and a new one linked on top: every place of three is held again, by four.
    const relinked = [stackedNode('PR_2', 1, 3), stackedNode('PR_3', 2, 3), stackedNode('PR_4', 3, 3)];
    github.stacks.set('ST_1', relinked);
    for (const node of relinked) {
        github.statuses.set(node.id, node);
    }

    // My work finds the new one; held from then on, so nothing drops what the stack no longer keeps — as a tracked
    // repository would keep its closed pull request.
    github.found.reviewRequested = [stackedNode('PR_2', 1, 3), stackedNode('PR_4', 3, 3)];
    await clock.advance(30_000);
    expect(items.get('PR_4')).toMatchObject({ stack: { id: 'ST_1', position: 3, size: 3 } });
    github.holdSearch = createPromise().promise;

    github.requests.length = 0;
    await clock.advance(30_000);
    expect(github.graphql('PullRequestStacks')).toEqual([['ST_1']]);
    expect(items.get('PR_1')).toMatchObject({ state: 'CLOSED', stack: null });

    github.requests.length = 0;
    await clock.advance(60_000);
    expect(github.graphql('PullRequestStacks')).toEqual([]);
});

test('a stack gone is asked once, its pull requests out of it; one GitHub refuses keeps them', async () => {
    const github = fakeGitHub();
    // The one that goes on saying it is in the stack is the one my work keeps, so the stack is still one the copy syncs.
    const mine = stackedNode('PR_1', 1, 3, 'MERGED');
    github.found.reviewRequested = [mine];
    github.stacks.set('ST_1', [mine, stackedNode('PR_2', 2, 3), stackedNode('PR_3', 3, 3)]);
    const { items, clock } = await setup(github, 'alice');

    // Dissolved: the open ones' statuses say so, the merged one still says it is in the stack.
    github.stacks.delete('ST_1');
    github.statuses.set('PR_2', pullRequestNode('PR_2', MONDAY));
    github.statuses.set('PR_3', pullRequestNode('PR_3', MONDAY));
    github.refused.set('ST_1', { type: 'FORBIDDEN', message: 'Resource protected by organization SAML enforcement.' });
    github.requests.length = 0;
    await clock.advance(60_000);
    expect(github.graphql('PullRequestStacks')).toEqual([['ST_1']]);
    expect(items.get('PR_1')).toMatchObject({ stack: { id: 'ST_1', position: 1, size: 3 } });

    github.refused.delete('ST_1');
    github.requests.length = 0;
    await clock.advance(60_000);
    expect(github.graphql('PullRequestStacks')).toEqual([['ST_1']]);
    expect(items.get('PR_1')).toMatchObject({ state: 'MERGED', stack: null });

    github.requests.length = 0;
    await clock.advance(60_000);
    expect(github.graphql('PullRequestStacks')).toEqual([]);
});

test('a pull request copied for its stack is read again whole when its `updatedAt` moved, and only then', async () => {
    const github = fakeGitHub();
    const mine = stackedNode('PR_2', 2, 3);
    github.found.reviewRequested = [mine];
    github.stacks.set('ST_1', [stackedNode('PR_1', 1, 3, 'MERGED'), mine, stackedNode('PR_3', 3, 3)]);
    const { items, clock } = await setup(github, 'alice');

    // Renamed: its status read brings the new `updatedAt`, the title only its row.
    const renamed = { ...stackedNode('PR_3', 3, 3), updatedAt: TUESDAY, title: 'Renamed' };
    github.stacks.set('ST_1', [stackedNode('PR_1', 1, 3, 'MERGED'), mine, renamed]);
    github.requests.length = 0;
    await clock.advance(60_000);
    expect(github.graphql('ItemsByIds')).toEqual([['PR_3']]);
    expect(items.get('PR_3')).toMatchObject({ title: 'Renamed', updatedAt: TUESDAY });

    github.requests.length = 0;
    await clock.advance(60_000);
    expect(github.graphql('PullRequestStatuses')).toEqual([['PR_2', 'PR_3']]);
    expect(github.graphql('ItemsByIds')).toEqual([]);
});

test('after signing out nothing more is asked of GitHub', async () => {
    const github = fakeGitHub();
    const { auth, clock } = await setup(github, 'alice');
    expect(github.requests.length).toBeGreaterThan(0);
    github.requests.length = 0;

    auth.signOut();
    await clock.advance(60 * 60_000);

    expect(github.requests).toEqual([]);
});

test("an answer for a session that has ended — another account took over in another tab — is not written into the new account's copy", async () => {
    const github = fakeGitHub();
    github.found.assigned = [issueNode('I_alice', MONDAY)];
    const held = createPromise();
    github.hold = held.promise;
    const { items, clock, fromAnotherTab } = await setup(github, 'alice');
    // Alice's re-read of her issue is on its way.
    expect(github.graphql('ItemsByIds')).toEqual([['I_alice']]);
    const switchedAt = github.requests.length;

    github.found.assigned = [];
    github.hold = null;
    fromAnotherTab({ [TOKEN_KEY]: 'gho_bob', [VIEWER_KEY]: JSON.stringify(viewerOf('bob')) });
    await items.ready();
    await clock.advance(0);

    held.resolve();
    // Looked at before Bob's next poll, whose clean-up would take it away again.
    await clock.advance(0);
    expect(items.get('I_alice')).toBeUndefined();

    await clock.advance(10 * 60_000);

    expect(items.get('I_alice')).toBeUndefined();
    expect(items.membership.assigned).toEqual(new Set());
    // Bob's loops polled; Alice's asked nothing more.
    const tokens = new Set(github.requests.slice(switchedAt).map(request => request.token));
    expect(tokens).toEqual(new Set(['gho_bob']));
});

test('a used-up search allowance pauses the loop until it resets: no request meanwhile, and the bar says until when', async () => {
    const github = fakeGitHub();
    github.searchAllowance = { remaining: 0, resetAt: START + 90_000 };
    const { sync, clock } = await setup(github, 'alice');

    // The answers reported the bucket empty: the next poll is not sent.
    expect(github.searches()).toHaveLength(4);
    await clock.advance(30_000);
    expect(github.searches()).toHaveLength(4);
    const expectedNotice: SyncNotice = {
        kind: 'paused',
        until: START + 90_000,
        allowance: { resource: 'search', limit: 30, remaining: 0, resetAt: new Date(START + 90_000) },
    };
    expect(sync.notice).toEqual(expectedNotice);
    // What it has was read a moment ago: that the next poll waits does not make it stale yet.
    const expectedFreshness: Freshness = { kind: 'fresh', checkedAt: START };
    expect(sync.myWorkFreshness).toEqual(expectedFreshness);

    github.searchAllowance = { remaining: 29, resetAt: START + 150_000 };
    await clock.advance(59_000);
    expect(github.searches()).toHaveLength(4);

    await clock.advance(1000);
    expect(github.searches()).toHaveLength(8);
    expect(sync.notice).toBeNull();
    expect(sync.myWorkFreshness.kind).toBe('fresh');
});

test("polling pauses with the GraphQL allowance down to what is kept for the user's edits, and resumes at the reset", async () => {
    const github = fakeGitHub();
    github.found.assigned = [issueNode('I_1', MONDAY)];
    const { sync, items, clock } = await setup(github, 'alice');

    // Read while more was known to be left; GitHub's answer says only the reserve is.
    github.graphqlAllowance = { remaining: EDIT_RESERVE, resetAt: START + 600_000 };
    github.found.assigned = [issueNode('I_1', TUESDAY)];
    await clock.advance(30_000);
    expect(github.graphql('ItemsByIds')).toEqual([['I_1'], ['I_1']]);

    // Changed again on GitHub: not read while only the reserve is left.
    github.found.assigned = [issueNode('I_1', WEDNESDAY)];
    await clock.advance(30_000);
    expect(github.graphql('ItemsByIds')).toHaveLength(2);
    expect(sync.notice).toMatchObject({
        kind: 'paused',
        until: START + 600_000,
        allowance: { resource: 'graphql', remaining: EDIT_RESERVE },
    });

    github.graphqlAllowance = { remaining: 5000, resetAt: START + 4_200_000 };
    await clock.advance(540_000);
    expect(sync.notice).toBeNull();
    expect(items.get('I_1')?.updatedAt).toBe(WEDNESDAY);
});

test('GitHub asking to slow down (403 with retry-after) pauses every loop for that long', async () => {
    const github = fakeGitHub();
    github.found.authored = [pullRequestNode('PR_1', MONDAY)];
    const { sync, clock } = await setup(github, 'alice');
    expect(github.graphql('PullRequestStatuses')).toEqual([['PR_1']]);

    github.requests.length = 0;
    github.refuseSearch = { status: 403, retryAfter: 120 };
    await clock.advance(30_000);
    expect(github.searches()).toHaveLength(4);
    expect(sync.notice).toEqual({ kind: 'paused', until: START + 150_000, allowance: null });

    // Statuses, due in the meantime, do not ask either: GitHub said it of all the user asks.
    github.refuseSearch = null;
    github.requests.length = 0;
    await clock.advance(119_000);
    expect(github.requests).toEqual([]);

    await clock.advance(1000);
    expect(github.searches()).toHaveLength(4);
    expect(github.graphql('PullRequestStatuses')).toEqual([['PR_1']]);
    expect(sync.notice).toBeNull();
});

test('a slow poll is never overlapped by the next one — not by its timer, the tab being shown or the connection coming back', async () => {
    const github = fakeGitHub();
    const held = createPromise();
    github.holdSearch = held.promise;
    const { clock, browser } = await setup(github, 'alice');
    expect(github.searches()).toHaveLength(4);

    await clock.advance(10 * 60_000);
    browser.hide();
    browser.show();
    browser.goOffline();
    browser.goOnline();
    await clock.advance(0);
    expect(github.searches()).toHaveLength(4);

    github.holdSearch = null;
    held.resolve();
    await clock.advance(0);
    expect(github.searches()).toHaveLength(4);

    await clock.advance(30_000);
    expect(github.searches()).toHaveLength(8);
});

test('first run and loading D14: on the first download my work says which groups are still arriving', async () => {
    const github = fakeGitHub();
    const all = createPromise();
    github.holdSearch = all.promise;
    const later = createPromise();
    github.holdGroups = { groups: ['assigned', 'mentioned'], until: later.promise };
    const { sync, clock } = await setup(github, 'alice');

    const nothingYet: Freshness = { kind: 'partial', arriving: [...MY_WORK_GROUPS] };
    expect(sync.myWorkFreshness).toEqual(nothingYet);

    all.resolve();
    await clock.advance(0);
    const someIn: Freshness = { kind: 'partial', arriving: ['assigned', 'mentioned'] };
    expect(sync.myWorkFreshness).toEqual(someIn);

    later.resolve();
    await clock.advance(0);
    expect(sync.myWorkFreshness).toEqual({ kind: 'fresh', checkedAt: START });
});

test('freshness: up to date after a poll, still up to date while the next one runs, stale "as of" the last success when offline', async () => {
    const github = fakeGitHub();
    const { sync, clock, browser } = await setup(github, 'alice');
    const polledAt = START;
    expect(sync.myWorkFreshness).toEqual({ kind: 'fresh', checkedAt: polledAt });

    browser.goOffline();
    // Fresh for an interval and some slack, whatever happens.
    await clock.advance(40_000);
    expect(sync.myWorkFreshness).toEqual({ kind: 'fresh', checkedAt: polledAt });
    expect(sync.notice).toEqual({ kind: 'offline', since: START });

    await clock.advance(10_000);
    const expected: Freshness = { kind: 'stale', since: polledAt, reason: 'offline' };
    expect(sync.myWorkFreshness).toEqual(expected);
    expect(github.searches()).toHaveLength(4);

    browser.goOnline();
    await clock.advance(0);
    expect(github.searches()).toHaveLength(8);
    expect(sync.myWorkFreshness).toEqual({ kind: 'fresh', checkedAt: START + 50_000 });
});

test('a draft begun on GitHub on a pull request only a tracked repository holds: the look finds it and marks nothing else, and the status re-read then follows it until it is gone', async () => {
    const github = fakeGitHub();
    const { items, clock } = await setup(github, 'alice', {
        tracked: [pullRequestNode('PR_1', MONDAY), pullRequestNode('PR_2', TUESDAY)],
    });
    const before = items.get('PR_1');
    assert(before?.kind === 'pullRequest');
    expect(github.graphql('PullRequestPendingReviews')).toEqual([['PR_1', 'PR_2']]);
    expect(github.graphql('PullRequestStatuses')).toEqual([]);

    github.drafts.set('PR_1', DRAFT);
    await clock.advance(299_000);
    expect(items.get('PR_1')).toEqual(before);

    await clock.advance(1000);
    expect(items.get('PR_1')).toEqual({
        ...before,
        pendingReview: { id: 'PRR_1', commentCount: 2, createdAt: MONDAY },
    });
    expect(items.get('PR_2')).toMatchObject({ pendingReview: null, updatedAt: TUESDAY });

    // Known now: the status re-read follows it, the look leaves it out.
    github.requests.length = 0;
    github.drafts.delete('PR_1');
    await clock.advance(60_000);
    expect(github.graphql('PullRequestStatuses')).toEqual([['PR_1']]);
    expect(items.get('PR_1')).toEqual(before);

    github.drafts.set('PR_2', DRAFT);
    await clock.advance(240_000);
    expect(github.graphql('PullRequestPendingReviews')).toEqual([['PR_1', 'PR_2']]);
    expect(items.get('PR_2')).toMatchObject({ pendingReview: { commentCount: 2 } });
});

test('the look for drafts leaves out what the status re-read covers and what is not open, and asks 100 at a time', async () => {
    const github = fakeGitHub();
    github.found.authored = [pullRequestNode('PR_mine', MONDAY)];
    const open = Array.from({ length: 101 }, (_, index) => pullRequestNode(`PR_${index}`, MONDAY));
    await setup(github, 'alice', {
        tracked: [
            pullRequestNode('PR_mine', MONDAY),
            stackedNode('PR_stacked', 1, 1),
            { ...pullRequestNode('PR_drafted', MONDAY), pendingReviews: { nodes: [DRAFT] } },
            { ...pullRequestNode('PR_closed', MONDAY), state: 'CLOSED' },
            { ...pullRequestNode('PR_merged', MONDAY), state: 'MERGED', merged: true },
            issueNode('I_1', MONDAY),
            ...open,
        ],
    });

    const ids = open.map(node => node.id);
    expect(github.graphql('PullRequestPendingReviews')).toEqual([ids.slice(0, 100), ids.slice(100)]);
});

test('a pull request gone or hidden does not stop the look for drafts, and keeps its row', async () => {
    const github = fakeGitHub();
    const { items, sync, clock } = await setup(github, 'alice', {
        tracked: [
            pullRequestNode('PR_gone', MONDAY),
            pullRequestNode('PR_hidden', MONDAY),
            pullRequestNode('PR_1', MONDAY),
        ],
    });

    github.deleted.add('PR_gone');
    github.refused.set('PR_hidden', { type: 'FORBIDDEN', message: 'Resource not accessible' });
    github.drafts.set('PR_1', DRAFT);
    await clock.advance(300_000);

    expect(items.get('PR_1')).toMatchObject({ pendingReview: { commentCount: 2 } });
    for (const id of ['PR_gone', 'PR_hidden']) {
        expect(items.get(id)).toMatchObject({ pendingReview: null });
    }

    expect(items.getSyncState('pendingReviews').lastError).toBeNull();
    expect(sync.notice).toBeNull();
});

test('the window regaining focus looks for drafts at most once a minute, however often it does', async () => {
    const github = fakeGitHub();
    const { clock, browser } = await setup(github, 'alice', { tracked: [pullRequestNode('PR_1', MONDAY)] });
    github.requests.length = 0;

    browser.focus();
    await clock.advance(59_000);
    browser.focus();
    browser.focus();
    await clock.advance(0);
    expect(github.graphql('PullRequestPendingReviews')).toEqual([]);

    await clock.advance(1000);
    browser.focus();
    browser.focus();
    await clock.advance(0);
    browser.focus();
    await clock.advance(0);
    expect(github.graphql('PullRequestPendingReviews')).toEqual([['PR_1']]);

    await clock.advance(60_000);
    browser.focus();
    await clock.advance(0);
    expect(github.graphql('PullRequestPendingReviews')).toEqual([['PR_1'], ['PR_1']]);
});

test('the look for drafts asks nothing at the reserve of the allowance or offline, and less often while hidden', async () => {
    const github = fakeGitHub();
    const { sync, clock, browser } = await setup(github, 'alice', { tracked: [pullRequestNode('PR_1', MONDAY)] });
    expect(github.graphql('PullRequestPendingReviews')).toHaveLength(1);

    github.requests.length = 0;
    browser.goOffline();
    await clock.advance(60_000);
    browser.focus();
    await clock.advance(0);
    expect(github.graphql('PullRequestPendingReviews')).toEqual([]);

    browser.goOnline();
    await clock.advance(0);
    expect(github.graphql('PullRequestPendingReviews')).toEqual([['PR_1']]);

    github.requests.length = 0;
    browser.hide();
    await clock.advance(899_000);
    expect(github.graphql('PullRequestPendingReviews')).toEqual([]);
    await clock.advance(1000);
    expect(github.graphql('PullRequestPendingReviews')).toEqual([['PR_1']]);
    browser.show();
    await clock.advance(0);

    // The answer tells of the reserve; asked again, it asks nothing.
    github.graphqlAllowance = { remaining: EDIT_RESERVE, resetAt: clock.now() + 600_000 };
    await clock.advance(60_000);
    browser.focus();
    await clock.advance(0);
    github.requests.length = 0;
    await clock.advance(60_000);
    browser.focus();
    await clock.advance(0);
    expect(github.graphql('PullRequestPendingReviews')).toEqual([]);
    expect(sync.notice).toMatchObject({ kind: 'paused', allowance: { resource: 'graphql' } });
});

type TrackedNode = IssueFieldsFragment | PullRequestFieldsFragment;

interface FakeRequest {
    readonly url: string;
    readonly token: string;
    /** The search query, or the GraphQL operation's name. */
    readonly name: string;
    readonly ids: readonly string[];
}

interface FakeGitHub {
    /** What each "my work" search finds; the node reads answer from these too. */
    found: Partial<Record<MyWorkGroup, readonly (IssueFieldsFragment | PullRequestFieldsFragment)[]>>;
    /** Read back as `null`, with a `NOT_FOUND` error at the node. */
    deleted: Set<string>;
    /** Read back as `null`, with this error at the node or (with a `path`) under it. */
    refused: Map<string, GitHubGraphQLErrorEntry>;
    /**
     * Read with a `FORBIDDEN` error at the project of this index of `projectItems` — an organisation's OAuth App
     * restrictions; the node itself should already have `null` there.
     */
    forbiddenProject: Map<string, number>;
    /** What `PullRequestStatuses` answers, over `found`. */
    statuses: Map<string, PullRequestStatusFieldsFragment>;
    /** Every item as the node reads answer it: what a search ever found, what a test keeps. */
    known: Map<string, TrackedNode>;
    /** The viewer's draft on a pull request, as `PullRequestPendingReviews` and `PullRequestStatuses` read it. */
    drafts: Map<string, typeof DRAFT>;
    /** The pull requests of each stack, by its id, as `PullRequestStacks` answers them. */
    stacks: Map<string, readonly PullRequestFieldsFragment[]>;
    requests: FakeRequest[];
    searchAllowance: { remaining: number; resetAt: number };
    graphqlAllowance: { remaining: number; resetAt: number };
    refuseSearch: { status: number; retryAfter: number } | null;
    /** This group's search fails with a 502. */
    failSearch: MyWorkGroup | null;
    /** GraphQL answers wait for it. */
    hold: Promise<void> | null;
    /** Searches wait for it. */
    holdSearch: Promise<void> | null;
    /** The search of these groups waits for it. */
    holdGroups: { readonly groups: readonly MyWorkGroup[]; readonly until: Promise<void> } | null;
    fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
    /** The queries searched, in order. */
    searches(): string[];
    /** The ids each call of the GraphQL operation `name` asked for. */
    graphql(name: string): (readonly string[])[];
}

/** GitHub answering the searches from `found` and the node reads from what the searches found. */
function fakeGitHub(): FakeGitHub {
    const github: FakeGitHub = {
        found: {},
        deleted: new Set(),
        refused: new Map(),
        forbiddenProject: new Map(),
        statuses: new Map(),
        known: new Map(),
        drafts: new Map(),
        stacks: new Map(),
        requests: [],
        searchAllowance: { remaining: 29, resetAt: START + 60_000 },
        graphqlAllowance: { remaining: 4800, resetAt: START + 3_600_000 },
        refuseSearch: null,
        failSearch: null,
        hold: null,
        holdSearch: null,
        holdGroups: null,
        fetch,
        searches: () =>
            github.requests.filter(request => request.url.includes('/search/')).map(request => request.name),
        graphql: name => github.requests.filter(request => request.name === name).map(request => request.ids),
    };
    return github;

    async function fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        const token = (new Headers(init?.headers).get('Authorization') ?? '').replace('Bearer ', '');

        if (url.pathname === '/search/issues') {
            const q = url.searchParams.get('q') ?? '';
            github.requests.push({ url: url.href, token, name: q, ids: [] });
            await github.holdSearch;
            const held = github.holdGroups;
            if (held && held.groups.some(group => QUERIES[group] === q)) {
                await held.until;
            }

            return searchAnswer(q);
        }

        if (url.pathname.startsWith('/repos/')) {
            return url.pathname.endsWith('/issues')
                ? Response.json([])
                : Response.json({ message: 'Not Found' }, { status: 404 });
        }

        const body: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
        const { name, ids } = readGraphQL(body);
        github.requests.push({ url: url.href, token, name, ids });
        await github.hold;
        const graphqlHeaders = rateLimitHeaders(
            'graphql',
            github.graphqlAllowance.remaining,
            github.graphqlAllowance.resetAt,
        );
        if (name === 'Viewer') {
            return Response.json(
                { data: { viewer: viewerOf(token.replace('gho_', '')) } },
                { headers: graphqlHeaders },
            );
        }

        if (name === 'PullRequestStacks') {
            const errors: GitHubGraphQLErrorEntry[] = [];
            const nodes = ids.map((id, index) => {
                const refused = github.refused.get(id);
                if (refused) {
                    errors.push({ ...refused, path: ['nodes', index] });
                    return null;
                }

                const members = github.stacks.get(id);
                return members
                    ? {
                          id,
                          entries: { totalCount: members.length, nodes: members.map(pullRequest => ({ pullRequest })) },
                      }
                    : null;
            });
            return Response.json(errors.length > 0 ? { data: { nodes }, errors } : { data: { nodes } }, {
                headers: graphqlHeaders,
            });
        }

        // As GitHub answers: `null` for a node it cannot give, with an error pointing at it.
        const errors: GitHubGraphQLErrorEntry[] = [];
        const nodes = ids.map((id, index) => {
            const refused = github.refused.get(id);
            if (refused) {
                errors.push({ ...refused, path: ['nodes', index, ...(refused.path ?? [])] });
                return null;
            }

            if (github.deleted.has(id)) {
                errors.push({
                    type: 'NOT_FOUND',
                    path: ['nodes', index],
                    message: `Could not resolve to a node with the global id of '${id}'`,
                });
                return null;
            }

            if (name === 'PullRequestPendingReviews') {
                const draft = github.drafts.get(id);
                return { pendingReviews: { nodes: draft ? [draft] : [] } };
            }

            const node = github.known.get(id) ?? null;
            const forbidden = github.forbiddenProject.get(id);
            if (forbidden !== undefined && node) {
                errors.push({
                    type: 'FORBIDDEN',
                    path: ['nodes', index, 'projectItems', 'nodes', forbidden, 'project'],
                    message:
                        'Although you appear to have the correct authorization credentials, the organization has enabled OAuth App access restrictions.',
                });
            }

            // A pull request copied for its stack, which no search found.
            const stacked = [...github.stacks.values()].flat().find(member => member.id === id);
            if (name !== 'PullRequestStatuses') {
                return node ?? stacked ?? null;
            }

            const status = github.statuses.get(id) ?? node ?? stacked ?? null;
            const draft = github.drafts.get(id);
            return status && draft ? { ...status, pendingReviews: { nodes: [draft] } } : status;
        });
        return Response.json(errors.length > 0 ? { data: { nodes }, errors } : { data: { nodes } }, {
            headers: graphqlHeaders,
        });
    }

    function searchAnswer(q: string) {
        const { remaining, resetAt } = github.searchAllowance;
        const headers = rateLimitHeaders('search', remaining, resetAt);
        if (github.refuseSearch) {
            headers.set('retry-after', String(github.refuseSearch.retryAfter));
            return Response.json(
                { message: 'You have exceeded a secondary rate limit.' },
                { status: github.refuseSearch.status, headers },
            );
        }

        const group = MY_WORK_GROUPS.find(key => QUERIES[key] === q);
        if (group !== undefined && group === github.failSearch) {
            return Response.json({ message: 'Server Error' }, { status: 502, headers });
        }

        const nodes = group ? (github.found[group] ?? []) : [];
        for (const node of nodes) {
            github.known.set(node.id, node);
        }

        const items = nodes.map(node => ({
            node_id: node.id,
            updated_at: node.updatedAt,
            number: node.number,
            repository_url: 'https://api.github.com/repos/acme/web',
            ...(node.__typename === 'PullRequest' ? { pull_request: {} } : {}),
        }));
        return Response.json({ total_count: items.length, incomplete_results: false, items }, { headers });
    }
}

function readGraphQL(body: unknown) {
    if (typeof body !== 'object' || body === null || !('query' in body) || !('variables' in body)) {
        throw new Error('Not a GraphQL request');
    }

    const name = /query\s+(\w+)/.exec(String(body.query))?.[1] ?? '';
    const { variables } = body;
    const ids =
        typeof variables === 'object' && variables !== null && 'ids' in variables && Array.isArray(variables.ids)
            ? variables.ids.map(String)
            : [];
    return { name, ids };
}

function rateLimitHeaders(resource: string, remaining: number, resetAt: number) {
    return new Headers({
        'x-ratelimit-resource': resource,
        'x-ratelimit-limit': resource === 'search' ? '30' : '5000',
        'x-ratelimit-remaining': String(remaining),
        'x-ratelimit-reset': String(Math.floor(resetAt / 1000)),
    });
}

interface SetupOptions {
    readonly tracked?: readonly TrackedNode[];
    readonly tabs?: TestTabs;
}

/**
 * Signs `login` in and waits for the first poll. The kept copy is empty, or holds `tracked` of the repository `acme/web`,
 * tracked and downloaded.
 */
async function setup(github: FakeGitHub, login: string, options: SetupOptions = {}) {
    const { tracked = [], tabs = createTestTabs() } = options;
    for (const node of tracked) {
        github.known.set(node.id, node);
    }

    const local = new Map<string, string>([
        [TOKEN_KEY, `gho_${login}`],
        [VIEWER_KEY, JSON.stringify(viewerOf(login))],
        ...(tracked.length > 0 ? ([[`githq.settings.${login}`, TRACKING_SLOT]] as const) : []),
    ]);
    const storageListeners: ((key: string | null) => void)[] = [];
    const visibilityListeners: (() => void)[] = [];
    const focusListeners: (() => void)[] = [];
    const online = fakeOnline();
    let visible = true;
    const tab = tabs.open();

    const browser: BrowserShape = {
        fetch: (input, init) => github.fetch(input, init),
        localStorage: {
            getItem: key => local.get(key) ?? null,
            setItem: (key, value) => {
                local.set(key, value);
            },
            removeItem: key => {
                local.delete(key);
            },
        },
        sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        origin: 'https://githq.test',
        getRandomValues: bytes => {
            crypto.getRandomValues(bytes);
        },
        reload: () => {},
        navigate: () => {},
        replaceLocation: () => {},
        openInNewTab: () => {},
        onLocalStorageChange: listener => {
            storageListeners.push(listener);
        },
        isVisible: () => visible,
        onVisibilityChange: listener => {
            visibilityListeners.push(listener);
        },
        onFocus: listener => {
            focusListeners.push(listener);
        },
        isOnline: online.isOnline,
        onOnlineChange: online.onOnlineChange,
        writeCookie: () => {},
        estimateStorage: () => Promise.resolve(null),
        ...tab,
    };

    const clock = fakeClock();
    const { container } = createTestContainer();
    container.set(Browser, browser);
    container.set(Clock, clock);
    container.set(ItemPersistence, {
        load: () =>
            Promise.resolve<PersistedItems>({
                items: mapNotNull(tracked, node => toItem(node)),
                membership: {},
                sync: {},
            }),
        save: async () => {},
        destroy: async () => {},
    });
    // Nothing tracked unless told: the loops of tracked repositories and projects have nothing to ask.
    container.set(TrackingPersistence, {
        loadSyncStates: () => Promise.resolve(tracked.length > 0 ? [TRACKED_SYNC_STATE] : []),
        saveSyncState: async () => {},
        deleteSyncState: async () => {},
    });
    container.set(ProjectPersistence, {
        loadProjects: () => Promise.resolve({ projects: [], items: [] }),
        saveProject: async () => {},
        saveProjectItems: async () => {},
        deleteProject: async () => {},
    });
    container.set(WorkflowPersistence, {
        loadWorkflows: () => Promise.resolve([]),
        saveWorkflows: async () => {},
        deleteWorkflows: async () => {},
    });

    const auth = container.resolve(AuthStore);
    const items = container.resolve(ItemStore);
    const sync = container.resolve(SyncEngine);
    const holds = container.resolve(RepositoryHolds);
    // The stored user's check with GitHub is not what these tests are about.
    github.requests.length = 0;
    await items.ready();
    await clock.advance(0);

    return {
        auth,
        items,
        sync,
        holds,
        clock,
        tab,
        browser: {
            hide: () => setVisible(false),
            show: () => setVisible(true),
            goOffline: () => online.setOnline(false),
            goOnline: () => online.setOnline(true),
            focus: () => {
                for (const listener of focusListeners) {
                    listener();
                }
            },
        },
        fromAnotherTab,
    };

    function setVisible(value: boolean) {
        visible = value;
        for (const listener of visibilityListeners) {
            listener();
        }
    }

    /** Another tab writes `changes` (`null` removes a key), and this tab gets a `storage` event for each. */
    function fromAnotherTab(changes: Record<string, string | null>) {
        for (const [key, value] of Object.entries(changes)) {
            if (value === null) {
                local.delete(key);
            } else {
                local.set(key, value);
            }
        }

        for (const key of Object.keys(changes)) {
            for (const listener of storageListeners) {
                listener(key);
            }
        }
    }
}

/** A clock that moves only when told, running the timers that fall due on the way and letting their work settle. */
function fakeClock() {
    let now = START;
    let timers: { at: number; callback: () => void }[] = [];

    const clock: ClockShape & { advance(ms: number): Promise<void> } = {
        now: () => now,
        schedule: (callback, delayMs) => {
            const timer = { at: now + delayMs, callback };
            timers.push(timer);
            return () => {
                timers = timers.filter(other => other !== timer);
            };
        },
        advance: async ms => {
            const end = now + ms;
            await settle();
            for (;;) {
                const next = timers.toSorted((a, b) => a.at - b.at)[0];
                if (!next || next.at > end) {
                    break;
                }

                timers = timers.filter(other => other !== next);
                now = next.at;
                next.callback();
                await settle();
            }

            now = end;
            await settle();
        },
    };
    return clock;
}

function viewerOf(login: string) {
    return { login, name: null, avatarUrl: `https://avatars.test/${login}` };
}

function issueNode(id: string, updatedAt: string): IssueFieldsFragment {
    return {
        __typename: 'Issue',
        id,
        url: `https://github.com/acme/web/issues/${id}`,
        number: 1,
        title: `Issue ${id}`,
        issueState: 'OPEN',
        stateReason: null,
        createdAt: MONDAY,
        updatedAt,
        closedAt: null,
        author: null,
        assignees: { nodes: [] },
        labels: { nodes: [] },
        milestone: null,
        issueType: null,
        comments: { totalCount: 0 },
        subIssuesSummary: { total: 0, completed: 0 },
        repository: REPOSITORY,
        projectItems: { nodes: [] },
    };
}

/** A pull request at `position` of the stack `ST_1` of `size` pull requests. */
function stackedNode(id: string, position: number, size: number, state: 'OPEN' | 'MERGED' | 'CLOSED' = 'OPEN') {
    return {
        ...pullRequestNode(id, MONDAY),
        state,
        merged: state === 'MERGED',
        stack: { id: 'ST_1', number: 1, size },
        stackEntry: { position },
    } satisfies PullRequestFieldsFragment;
}

function pullRequestNode(id: string, updatedAt: string): PullRequestFieldsFragment {
    return {
        __typename: 'PullRequest',
        id,
        url: `https://github.com/acme/web/pull/${id}`,
        number: 2,
        title: `Pull request ${id}`,
        state: 'OPEN',
        isDraft: false,
        merged: false,
        reviewDecision: 'REVIEW_REQUIRED',
        mergeable: 'MERGEABLE',
        mergeStateStatus: 'BLOCKED',
        headRefOid: 'head-oid',
        headRef: { id: 'REF_1' },
        isCrossRepository: false,
        viewerCanDeleteHeadRef: false,
        isMergeQueueEnabled: false,
        mergeQueueEntry: null,
        autoMergeRequest: null,
        createdAt: MONDAY,
        updatedAt,
        closedAt: null,
        additions: 1,
        deletions: 1,
        changedFiles: 1,
        headRefName: 'feature',
        baseRefName: 'main',
        author: null,
        assignees: { nodes: [] },
        labels: { nodes: [] },
        milestone: null,
        comments: { totalCount: 0 },
        closingIssuesReferences: { nodes: [] },
        repository: REPOSITORY,
        projectItems: { nodes: [] },
        statusCheckRollup: null,
        reviewRequests: { nodes: [] },
        latestOpinionatedReviews: { nodes: [] },
        pendingReviews: { nodes: [] },
        stack: null,
        stackEntry: null,
        baseRefOid: 'base-oid',
        baseRef: { target: { oid: 'base-oid' } },
    };
}
