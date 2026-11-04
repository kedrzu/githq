/// <reference types="bun" />
// IndexedDB for bun; every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';
import type { IssueFieldsFragment, PullRequestFieldsFragment } from '@githq/github/generated.gen.js';
import { createPromise } from '@nzyme/utils/createPromise.js';

import { ProjectStore } from '@/projects/ProjectStore.js';
import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { createIndexedDbPersistence } from '@/store/IndexedDbPersistence.js';
import type { IndexedDbPersistence } from '@/store/IndexedDbPersistence.js';
import { ItemStore } from '@/store/ItemStore.js';
import { toItem } from '@/store/toItem.js';
import type { Freshness } from '@/sync/Freshness.js';
import { SyncEngine } from '@/sync/SyncEngine.js';
import { createTestSession } from '@/testing/createTestSession.js';
import type { TestGraphQLAnswer, TestGraphQLRequest, TestRestAnswer } from '@/testing/createTestSession.js';
import { createTestTabs } from '@/testing/createTestTabs.js';
import type { TestTabs } from '@/testing/createTestTabs.js';
import { sampleIssueNode, samplePullRequestNode } from '@/testing/sampleRowNodes.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { BROWSE_FRESH_MS, BROWSE_POLL_MS, BrowsedRepositories } from './BrowsedRepositories.js';
import { RepositoryHolds } from './RepositoryHolds.js';

const WEB = 'acme/web';
const TEN_MINUTES = 600_000;
const EARLIER = '2026-10-26T10:00:00Z';
const LATER = '2026-10-30T13:20:00Z';
const VIEW = { nameWithOwner: WEB, section: 'issues', state: 'open' } as const;

test('re-entering within 10 s asks nothing; after it one conditional check; a 304 re-reads nothing; a 200 only what moved; and every 60 s while shown', async () => {
    const tab = await openTab();
    tab.world.addPage('RepositoryIssues OPEN', [issue('I_1', 1), issue('I_2', 2)]);
    tab.world.nodes.set('PR_1', pullRequest('PR_1', 3));

    // The first page on entering, and no check with it.
    const leave = tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);
    expect(tab.asked()).toEqual(['RepositoryIssues OPEN']);
    expect(tab.items.get('I_1')?.title).toBe('Issue I_1');
    expect(tab.browsed.getStatus(WEB, 'issues', 'open').total).toBe(2);
    tab.clear();
    leave();

    await tab.session.clock.advance(BROWSE_FRESH_MS - 1);
    const backSoon = tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);
    expect(tab.asked()).toEqual([]);
    backSoon();

    await tab.session.clock.advance(1);
    tab.world.check = () => ({ status: 304 });
    const back = tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);
    expect(tab.asked()).toEqual([`GET /repos/${WEB}/issues`]);
    tab.clear();

    // A minute on: moved are one issue and a pull request, which the section of issues leaves alone; the other issue
    // is listed as it is held.
    tab.world.nodes.set('I_1', issue('I_1', 1, LATER));
    tab.world.check = () => ({
        status: 200,
        etag: '"after"',
        body: [
            { node_id: 'I_1', number: 1, updated_at: LATER },
            { node_id: 'I_2', number: 2, updated_at: EARLIER },
            { node_id: 'PR_1', number: 3, updated_at: LATER, pull_request: {} },
        ],
    });
    await tab.session.clock.advance(BROWSE_POLL_MS);
    expect(tab.asked()).toEqual([`GET /repos/${WEB}/issues`, 'ItemsByIds I_1']);
    expect(tab.items.getStored('I_1')?.updatedAt).toBe(LATER);
    expect(tab.items.getStored('PR_1')).toBeUndefined();
    const sinceAfterChange = new Date(tab.session.clock.now() - TEN_MINUTES).toISOString();
    tab.clear();

    // The ETag and the moved `since` go with the next, and 304 asks nothing more.
    tab.world.check = () => ({ status: 304 });
    await tab.session.clock.advance(BROWSE_POLL_MS);
    expect(tab.asked()).toEqual([`GET /repos/${WEB}/issues`]);
    expect(tab.checks().at(-1)?.variables).toMatchObject({ ifNoneMatch: '"after"', since: sinceAfterChange });

    back();
});

test('hiding the tab stops the checks; shown again, it checks at once if overdue and otherwise at the end of the interval', async () => {
    const tab = await openTab();
    tab.world.addPage('RepositoryIssues OPEN', [issue('I_1', 1)]);
    tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);
    tab.clear();

    tab.session.setVisible(false);
    await tab.session.clock.advance(5 * BROWSE_POLL_MS);
    expect(tab.asked()).toEqual([]);

    tab.session.setVisible(true);
    await tab.session.clock.advance(0);
    expect(tab.asked()).toEqual([`GET /repos/${WEB}/issues`]);
    tab.clear();

    // Hidden and shown within the interval: no check on showing, and the one due still comes.
    await tab.session.clock.advance(20_000);
    tab.session.setVisible(false);
    tab.session.setVisible(true);
    await tab.session.clock.advance(0);
    expect(tab.asked()).toEqual([]);
    await tab.session.clock.advance(BROWSE_POLL_MS - 20_000);
    expect(tab.asked()).toEqual([`GET /repos/${WEB}/issues`]);
});

test('a section entered in a hidden tab asks nothing, nor does asking for more, until the tab is shown', async () => {
    const tab = await openTab();
    tab.world.addPage('RepositoryIssues OPEN', [issue('I_1', 1)], { next: 'c2' });
    tab.session.setVisible(false);
    tab.browsed.show(VIEW);
    await tab.browsed.loadMore(WEB, 'issues', 'open');
    await tab.session.clock.advance(2 * BROWSE_POLL_MS);
    expect(tab.asked()).toEqual([]);

    tab.session.setVisible(true);
    await tab.session.clock.advance(0);
    expect(tab.asked()).toEqual(['RepositoryIssues OPEN']);
});

test('switching section or leaving stops its checks: only the section shown is asked about', async () => {
    const tab = await openTab();
    tab.world.addPage('RepositoryIssues OPEN', [issue('I_1', 1)]);
    tab.world.addPage('RepositoryPullRequests OPEN', [pullRequest('PR_1', 2)]);

    const issues = tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);
    issues();
    tab.clear();

    await tab.session.clock.advance(3 * BROWSE_POLL_MS);
    expect(tab.asked()).toEqual([]);

    const pullRequests = tab.browsed.show({ nameWithOwner: WEB, section: 'pullRequests', state: 'open' });
    await tab.session.clock.advance(0);
    expect(tab.asked()).toEqual(['RepositoryPullRequests OPEN']);
    // 30 to a page, as 100 with their status time out.
    expect(tab.session.github.requests.at(-1)?.variables.first).toBe(30);
    tab.clear();

    await tab.session.clock.advance(BROWSE_POLL_MS);
    expect(tab.asked()).toEqual([`GET /repos/${WEB}/issues`]);
    tab.clear();

    pullRequests();
    await tab.session.clock.advance(3 * BROWSE_POLL_MS);
    expect(tab.asked()).toEqual([]);
});

test('the answer to a section no longer shown is not written, and the section reads it again when shown', async () => {
    const tab = await openTab();
    tab.world.addPage('RepositoryIssues OPEN', [issue('I_1', 1)]);
    const held = createPromise();
    tab.session.github.holdIf = request => (request.operation === 'RepositoryIssues' ? held.promise : null);

    const leave = tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);
    expect(tab.browsed.getStatus(WEB, 'issues', 'open').reading).toBe(true);
    leave();
    held.resolve();
    await tab.session.clock.advance(0);

    expect(tab.items.get('I_1')).toBeUndefined();
    expect(tab.browsed.getStatus(WEB, 'issues', 'open')).toMatchObject({ reading: false, total: null });

    tab.clear();
    tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);
    expect(tab.asked()).toEqual(['RepositoryIssues OPEN']);
    expect(tab.items.get('I_1')?.number).toBe(1);
});

test('the re-reading of a check stopped halfway is not written either', async () => {
    const tab = await openTab();
    tab.world.addPage('RepositoryIssues OPEN', [issue('I_1', 1)]);
    const leave = tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);

    tab.world.nodes.set('I_1', issue('I_1', 1, LATER));
    tab.world.check = () => ({ status: 200, etag: '"x"', body: [{ node_id: 'I_1', number: 1, updated_at: LATER }] });
    const held = createPromise();
    tab.session.github.holdIf = request => (request.operation === 'ItemsByIds' ? held.promise : null);
    await tab.session.clock.advance(BROWSE_POLL_MS);
    expect(tab.asked().at(-1)).toBe('ItemsByIds I_1');

    leave();
    held.resolve();
    await tab.session.clock.advance(0);
    expect(tab.items.getStored('I_1')?.updatedAt).toBe(EARLIER);
});

test('an answer for an account gone is not written; shown for the new one, it is read for it, and signing out ends it', async () => {
    const tab = await openTab();
    tab.world.addPage('RepositoryIssues OPEN', [issue('I_1', 1)]);
    const held = createPromise();
    tab.session.github.holdIf = request => (request.operation === 'RepositoryIssues' ? held.promise : null);
    tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);

    const next = uniqueLogin();
    tab.session.signInFromAnotherTab(next);
    await tab.items.ready();
    tab.session.github.holdIf = null;
    held.resolve();
    await tab.session.clock.advance(0);
    expect(tab.browsed.getStatus(WEB, 'issues', 'open').total).toBeNull();
    expect(tab.items.get('I_1')).toBeUndefined();

    tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);
    const reads = tab.session.github.requests.filter(request => request.operation === 'RepositoryIssues');
    expect(reads.map(request => request.token)).toEqual([`gho_${tab.login}`, `gho_${next}`]);
    expect(tab.browsed.getStatus(WEB, 'issues', 'open').total).toBe(1);
    expect(tab.items.get('I_1')?.number).toBe(1);

    tab.session.signOutFromAnotherTab();
    await tab.session.clock.advance(0);
    tab.clear();
    expect(tab.browsed.getStatus(WEB, 'issues', 'open').total).toBeNull();
    await tab.session.clock.advance(3 * BROWSE_POLL_MS);
    expect(tab.asked()).toEqual([]);
});

test('an allowance used up sends nothing, the freshness says paused, and the reset takes it up again', async () => {
    const tab = await openTab();
    tab.world.addPage('RepositoryIssues OPEN', [issue('I_1', 1)], { next: 'c2' });
    const resetAt = tab.session.clock.now() + 2 * BROWSE_POLL_MS + 30_000;

    // GraphQL used up (but for what is kept for edits): no first page.
    const rateLimits = tab.session.container.resolve(GitHubRateLimitStore);
    rateLimits.update({ resource: 'graphql', limit: 5000, remaining: 100, resetAt: new Date(resetAt) });
    const leave = tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);
    expect(tab.asked()).toEqual([]);
    expect(tab.browsed.getStatus(WEB, 'issues', 'open').reading).toBe(false);
    const paused: Freshness = { kind: 'paused', since: null, until: resetAt };
    expect(tab.browsed.getFreshness(WEB, 'issues')).toEqual(paused);

    // Nothing while it lasts, and at its end the page, without waiting for the next interval.
    await tab.session.clock.advance(resetAt - tab.session.clock.now() - 1);
    expect(tab.asked()).toEqual([]);
    await tab.session.clock.advance(1);
    expect(tab.asked()).toEqual(['RepositoryIssues OPEN']);
    tab.clear();

    // Core used up: no check, though a page may go. (Every REST answer of the sync loops says the same.)
    tab.session.github.coreRemaining = 0;
    const coreReset = tab.session.clock.now() + BROWSE_POLL_MS * 5;
    rateLimits.update({ resource: 'core', limit: 5000, remaining: 0, resetAt: new Date(coreReset) });
    tab.world.addPage('RepositoryIssues OPEN after c2', [issue('I_2', 2)]);
    await tab.browsed.loadMore(WEB, 'issues', 'open');
    await tab.session.clock.advance(2 * BROWSE_POLL_MS);
    expect(tab.asked()).toEqual(['RepositoryIssues OPEN after c2']);
    tab.clear();

    // Allowance back, entering checks at once.
    tab.session.github.coreRemaining = 4900;
    rateLimits.update({ resource: 'core', limit: 5000, remaining: 4900, resetAt: new Date(coreReset) });
    leave();
    tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);
    expect(tab.asked()).toEqual([`GET /repos/${WEB}/issues`]);
});

test('GitHub asking to slow down sends nothing: told to a sync loop here or in the syncing tab, or to the reader itself', async () => {
    const tab = await openTab();
    tab.world.addPage('RepositoryIssues OPEN', [issue('I_1', 1)]);
    const leave = tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);
    tab.clear();

    // The reader's own check is refused: a minute without a word to GitHub, entering again included.
    tab.world.check = () => ({ status: 429, body: { message: 'API rate limit exceeded' } });
    await tab.session.clock.advance(BROWSE_POLL_MS);
    expect(tab.asked()).toEqual([`GET /repos/${WEB}/issues`]);
    tab.clear();
    tab.world.check = () => ({ status: 304 });
    await tab.session.clock.advance(20_000);
    leave();
    tab.browsed.show(VIEW);
    await tab.session.clock.advance(BROWSE_POLL_MS - 20_000 - 1);
    expect(tab.asked()).toEqual([]);
    await tab.session.clock.advance(1);
    expect(tab.asked()).toEqual([`GET /repos/${WEB}/issues`]);
    tab.clear();

    // A sync loop is told to slow down: the notice holds the reader as well.
    tab.world.searchRefused = true;
    await tab.session.clock.advance(30_000);
    expect(tab.session.container.resolve(SyncEngine).notice?.kind).toBe('paused');
    tab.world.searchRefused = false;
    tab.clear();
    await tab.session.clock.advance(30_000);
    expect(tab.asked()).toEqual([]);
});

test('a repository GitHub does not show gets no further checks until it is shown anew', async () => {
    const tab = await openTab();
    tab.world.repositoryMissing = true;

    const leave = tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);
    expect(tab.asked()).toEqual(['RepositoryIssues OPEN']);
    expect(tab.browsed.getStatus(WEB, 'issues', 'open').notShown).toBe(true);
    tab.clear();

    // A remount at once takes the answer just had.
    leave();
    const remounted = tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);
    expect(tab.asked()).toEqual([]);

    await tab.session.clock.advance(5 * BROWSE_POLL_MS);
    // Hidden and shown again is not shown anew.
    tab.session.setVisible(false);
    tab.session.setVisible(true);
    await tab.session.clock.advance(0);
    expect(tab.asked()).toEqual([]);
    remounted();

    // Shown anew, and shown by GitHub now.
    tab.world.repositoryMissing = false;
    tab.world.addPage('RepositoryIssues OPEN', [issue('I_1', 1)]);
    tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);
    expect(tab.asked()).toEqual(['RepositoryIssues OPEN']);
    expect(tab.browsed.getStatus(WEB, 'issues', 'open')).toMatchObject({ notShown: false, total: 1 });
});

test('a check answered 404 says the repository is not shown, and stops the checks', async () => {
    const tab = await openTab();
    tab.world.addPage('RepositoryIssues OPEN', [issue('I_1', 1)]);
    tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);
    tab.clear();

    tab.world.check = () => ({ status: 404, body: { message: 'Not Found' } });
    await tab.session.clock.advance(BROWSE_POLL_MS);
    expect(tab.asked()).toEqual([`GET /repos/${WEB}/issues`]);
    expect(tab.browsed.getStatus(WEB, 'issues', 'open').notShown).toBe(true);
    tab.clear();

    await tab.session.clock.advance(5 * BROWSE_POLL_MS);
    expect(tab.asked()).toEqual([]);
});

test('pages of one state do not disturb another: each goes on from its own cursor, its total its own', async () => {
    const tab = await openTab();
    tab.world.addPage('RepositoryPullRequests OPEN', [pullRequest('PR_1', 1)], { next: 'open2', total: 40 });
    tab.world.addPage('RepositoryPullRequests OPEN after open2', [pullRequest('PR_2', 2)], { total: 40 });
    tab.world.addPage('RepositoryPullRequests CLOSED,MERGED', [pullRequest('PR_3', 3)], { next: 'closed2', total: 7 });
    tab.world.addPage('RepositoryPullRequests CLOSED,MERGED after closed2', [pullRequest('PR_4', 4)], { total: 7 });
    tab.world.addPage('RepositoryPullRequests OPEN,CLOSED,MERGED', [pullRequest('PR_1', 1)], { total: 47 });

    for (const state of ['open', 'closed', 'all'] as const) {
        tab.browsed.show({ nameWithOwner: WEB, section: 'pullRequests', state });
        await tab.session.clock.advance(0);
    }

    expect(tab.browsed.getStatus(WEB, 'pullRequests', 'open')).toMatchObject({ total: 40, hasMore: true });
    expect(tab.browsed.getStatus(WEB, 'pullRequests', 'closed')).toMatchObject({ total: 7, hasMore: true });
    expect(tab.browsed.getStatus(WEB, 'pullRequests', 'all')).toMatchObject({ total: 47, hasMore: false });
    tab.clear();

    await tab.browsed.loadMore(WEB, 'pullRequests', 'closed');
    expect(tab.browsed.getStatus(WEB, 'pullRequests', 'open').hasMore).toBe(true);
    expect(tab.browsed.getStatus(WEB, 'pullRequests', 'closed').hasMore).toBe(false);
    await tab.browsed.loadMore(WEB, 'pullRequests', 'open');
    // Each read its own next page, and nothing is left to read of either.
    await tab.browsed.loadMore(WEB, 'pullRequests', 'closed');
    await tab.browsed.loadMore(WEB, 'pullRequests', 'all');
    expect(tab.asked()).toEqual([
        'RepositoryPullRequests CLOSED,MERGED after closed2',
        'RepositoryPullRequests OPEN after open2',
    ]);
});

test('a page on its way is not asked for twice', async () => {
    const tab = await openTab();
    tab.world.addPage('RepositoryIssues OPEN', [issue('I_1', 1)], { next: 'c2' });
    tab.world.addPage('RepositoryIssues OPEN after c2', [issue('I_2', 2)]);
    tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);
    tab.clear();

    const held = createPromise();
    tab.session.github.holdIf = request => (request.operation === 'RepositoryIssues' ? held.promise : null);
    void tab.browsed.loadMore(WEB, 'issues', 'open');
    void tab.browsed.loadMore(WEB, 'issues', 'open');
    await tab.session.clock.advance(0);
    expect(tab.asked()).toEqual(['RepositoryIssues OPEN after c2']);
    expect(tab.browsed.getStatus(WEB, 'issues', 'open')).toMatchObject({ reading: true, cursor: 'c2', total: 1 });

    held.resolve();
    await tab.session.clock.advance(0);
    expect(tab.browsed.getStatus(WEB, 'issues', 'open')).toMatchObject({
        reading: false,
        hasMore: false,
        cursor: null,
    });
});

test('a shown section whose rows have gone reads its first page again: at the next check, or on entering', async () => {
    const tab = await openTab();
    tab.world.addPage('RepositoryIssues OPEN', [issue('I_1', 1)], { next: 'c2' });
    const leave = tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);
    tab.clear();

    // Gone from the store, as a clean-up in a tab that did not know of this one's hold would have it.
    tab.items.remove(['I_1']);
    await tab.session.clock.advance(BROWSE_POLL_MS);
    expect(tab.asked()).toEqual(['RepositoryIssues OPEN']);
    expect(tab.items.get('I_1')?.number).toBe(1);
    tab.clear();

    leave();
    tab.items.remove(['I_1']);
    tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);
    expect(tab.asked()).toEqual(['RepositoryIssues OPEN']);
});

test('a first read that failed is tried again at the next interval, as a read rather than a check, and the freshness tells', async () => {
    const tab = await openTab();
    tab.browsed.show(VIEW);
    expect(tab.browsed.getFreshness(WEB, 'issues').kind).toBe('partial');
    tab.world.failing = true;
    await tab.session.clock.advance(0);
    const failing: Freshness = { kind: 'stale', since: null, reason: 'failing' };
    expect(tab.browsed.getFreshness(WEB, 'issues')).toEqual(failing);
    tab.clear();

    tab.world.failing = false;
    tab.world.addPage('RepositoryIssues OPEN', [issue('I_1', 1)]);
    await tab.session.clock.advance(BROWSE_POLL_MS);
    expect(tab.asked()).toEqual(['RepositoryIssues OPEN']);
    const fresh: Freshness = { kind: 'fresh', checkedAt: tab.session.clock.now() };
    expect(tab.browsed.getFreshness(WEB, 'issues')).toEqual(fresh);
});

test('the freshness turns with time alone: checks failing stay fresh for the slack, then say so', async () => {
    const tab = await openTab();
    tab.world.addPage('RepositoryIssues OPEN', [issue('I_1', 1)]);
    tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);
    const checkedAt = tab.session.clock.now();
    tab.world.check = () => ({ status: 500, body: { message: 'Server Error' } });

    await tab.session.clock.advance(BROWSE_POLL_MS + 15_000);
    expect(tab.browsed.getFreshness(WEB, 'issues').kind).toBe('fresh');
    await tab.session.clock.advance(1);
    const failing: Freshness = { kind: 'stale', since: checkedAt, reason: 'failing' };
    expect(tab.browsed.getFreshness(WEB, 'issues')).toEqual(failing);
});

test('offline it asks nothing and says so; back online it asks', async () => {
    const tab = await openTab();
    tab.world.addPage('RepositoryIssues OPEN', [issue('I_1', 1)]);
    tab.session.setOnline(false);
    tab.browsed.show(VIEW);
    await tab.session.clock.advance(BROWSE_POLL_MS);
    expect(tab.asked()).toEqual([]);
    expect(tab.browsed.getFreshness(WEB, 'issues')).toEqual({ kind: 'stale', since: null, reason: 'offline' });

    tab.session.setOnline(true);
    await tab.session.clock.advance(0);
    expect(tab.asked()).toEqual(['RepositoryIssues OPEN']);
});

test('a fresh start drops what a reload left of the rows only browsed, in any case of the name, and only them', async () => {
    const login = uniqueLogin();
    const persistence = createIndexedDbPersistence();
    const first = await openTab({ login, persistence, world: quietWorld(), holding: false });
    first.items.upsertMany([
        row(issue('I_stale', 1)),
        row(issue('I_tracked', 2, EARLIER, 'acme/tracked')),
        row(issue('I_mine', 3)),
        row(issue('I_elsewhere', 4, EARLIER, 'acme/api')),
    ]);
    first.items.setMembership('assigned', ['I_mine']);
    first.tracking.choose({ repositories: [{ nameWithOwner: 'acme/tracked', id: 'R_t' }], projects: [] });
    await first.items.flush();
    await first.session.clock.advance(0);

    const second = await openTab({
        login,
        persistence: createIndexedDbPersistence(),
        world: quietWorld(),
        localStorage: first.session.localStorage,
        holding: false,
    });
    expect(second.items.get('I_stale')?.number).toBe(1);

    second.browsed.hold('ACME/Web');
    expect(second.items.get('I_stale')).toBeUndefined();
    expect(second.items.get('I_mine')?.number).toBe(3);
    expect(second.items.get('I_elsewhere')?.number).toBe(4);

    // A tracked repository's rows stay, were it to pass through here, and a second hold starts nothing anew.
    second.browsed.hold('acme/tracked');
    expect(second.items.get('I_tracked')?.number).toBe(2);
    second.items.upsertMany([row(issue('I_read', 5))]);
    second.browsed.hold(WEB);
    expect(second.items.get('I_read')?.number).toBe(5);
});

test('a fresh start waits for the kept copy: rows of a project or a tracked repository are not taken for rows only browsed', async () => {
    const login = uniqueLogin();
    const persistence = createIndexedDbPersistence();
    const first = await openTab({ login, persistence, world: quietWorld(), holding: false });
    first.tracking.choose({
        repositories: [],
        projects: [{ id: 'PVT_1', owner: 'acme', ownerKind: 'org', number: 1, title: 'Roadmap' }],
    });
    first.items.upsertMany([row(issue('I_stale', 1)), row(issue('I_project', 2))]);
    const projects = first.session.container.resolve(ProjectStore);
    projects.upsertItems([
        {
            itemId: 'PVTI_1',
            projectId: 'PVT_1',
            contentId: 'I_project',
            draft: null,
            values: {},
            updatedAt: EARLIER,
            isArchived: false,
        },
    ]);
    await first.items.flush();
    await projects.flush();
    await first.session.clock.advance(0);

    // A reload onto the repository's screen: held and shown before the kept copy has been read.
    const session = createTestSession({
        login,
        answer: () => undefined,
        localStorage: first.session.localStorage,
    });
    setIndexedDbPersistence(session.container, createIndexedDbPersistence());
    const browsed = session.container.resolve(BrowsedRepositories);
    const items = session.container.resolve(ItemStore);
    browsed.hold(WEB);
    browsed.show(VIEW);
    expect(session.operations()).toEqual([]);
    await items.ready();
    await session.clock.advance(0);

    expect(items.get('I_project')?.number).toBe(2);
    expect(items.get('I_stale')).toBeUndefined();
    expect(session.operations()).toContain('RepositoryIssues');
});

test('a fresh start leaves the rows of a repository another tab is known to hold', async () => {
    const tabs = createTestTabs();
    const login = uniqueLogin();
    const holding = await openTab({ login, tabs, holding: false });
    holding.world.addPage('RepositoryIssues OPEN', [issue('I_1', 1)]);
    holding.browsed.hold(WEB);
    holding.browsed.show(VIEW);
    await holding.session.clock.advance(0);

    const opening = await openTab({ login, tabs, holding: false });
    await holding.session.clock.advance(0);
    await opening.session.clock.advance(0);
    expect(opening.items.get('I_1')?.number).toBe(1);

    opening.browsed.hold(WEB);
    await holding.session.clock.advance(0);
    expect(opening.items.get('I_1')?.number).toBe(1);
    expect(holding.items.get('I_1')?.number).toBe(1);
});

test('a case different from GitHub settles the name: the state stays, the screen remounted under it goes on with nothing lost', async () => {
    const tab = await openTab({ holding: false });
    tab.world.addPage('RepositoryIssues OPEN', [issue('I_1', 1)], { next: 'c2', owner: 'Acme/Web' });
    tab.world.addPage('RepositoryIssues OPEN after c2', [issue('I_2', 2, EARLIER, 'Acme/Web')]);

    const release = tab.browsed.hold('acme/WEB');
    const leave = tab.browsed.show({ ...VIEW, nameWithOwner: 'acme/WEB' });
    await tab.session.clock.advance(0);
    expect(tab.browsed.getStatus('acme/WEB', 'issues', 'open').settledName).toBe('Acme/Web');
    expect(tab.browsed.getStatus('Acme/Web', 'issues', 'open')).toMatchObject({ settledName: null, total: 1 });
    tab.clear();

    // As the page remounts: the old one leaves, then the new one holds and shows.
    leave();
    release();
    tab.browsed.hold('Acme/Web');
    tab.browsed.show({ ...VIEW, nameWithOwner: 'Acme/Web' });
    await tab.browsed.loadMore('Acme/Web', 'issues', 'open');
    await tab.session.clock.advance(0);
    expect(tab.asked()).toEqual(['RepositoryIssues OPEN after c2']);
    expect(tab.items.get('I_1')?.number).toBe(1);
});

test('a renamed repository moves to GitHub`s name with its hold, and the hold taken for it ends with the rest', async () => {
    const tab = await openTab({ holding: false });
    tab.world.addPage('RepositoryIssues OPEN', [issue('I_1', 1, EARLIER, 'acme/renamed')]);
    tab.world.addPage('RepositoryPullRequests OPEN', [pullRequest('PR_1', 2, 'acme/renamed')]);
    const holds = tab.session.container.resolve(RepositoryHolds);

    const release = tab.browsed.hold('acme/old');
    const leave = tab.browsed.show({ ...VIEW, nameWithOwner: 'acme/old' });
    const pullRequests = tab.browsed.show({ nameWithOwner: 'acme/old', section: 'pullRequests', state: 'open' });
    await tab.session.clock.advance(0);

    // Held under the new name before anything says so; both sections moved, each answering under either name.
    expect(holds.isHeld('acme/renamed')).toBe(true);
    expect(tab.browsed.getStatus('acme/old', 'issues', 'open').settledName).toBe('acme/renamed');
    expect(tab.browsed.getStatus('acme/old', 'pullRequests', 'open').settledName).toBe('acme/renamed');
    expect(tab.browsed.getStatus('acme/renamed', 'issues', 'open')).toMatchObject({ settledName: null, total: 1 });
    tab.clear();

    leave();
    pullRequests();
    release();
    // The new page's hold starts nothing anew, its show reads nothing: re-entered within the 10 seconds.
    const newRelease = tab.browsed.hold('acme/renamed');
    expect(tab.items.get('I_1')?.number).toBe(1);
    const newLeave = tab.browsed.show({ ...VIEW, nameWithOwner: 'acme/renamed' });
    await tab.session.clock.advance(0);
    expect(tab.asked()).toEqual([]);

    // The old address lasts its ten minutes while the new page is open, and the state survives it.
    await tab.session.clock.advance(TEN_MINUTES);
    expect(holds.isHeld('acme/old')).toBe(false);
    expect(tab.browsed.getStatus('acme/renamed', 'issues', 'open').total).toBe(1);
    expect(tab.browsed.getStatus('acme/old', 'issues', 'open').settledName).toBeNull();

    // Nothing is left behind once the page is gone: the hold on the new name ends after its ten minutes.
    newLeave();
    newRelease();
    await tab.session.clock.advance(TEN_MINUTES);
    expect(holds.isHeld('acme/renamed')).toBe(false);
});

test('a hold let go drops the section`s state: entering again reads its first page', async () => {
    const tab = await openTab({ holding: false });
    tab.world.addPage('RepositoryIssues OPEN', [issue('I_1', 1)]);
    const release = tab.browsed.hold(WEB);
    const leave = tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);
    leave();
    release();

    await tab.session.clock.advance(TEN_MINUTES - 1);
    expect(tab.browsed.getStatus(WEB, 'issues', 'open').total).toBe(1);
    await tab.session.clock.advance(1);
    expect(tab.browsed.getStatus(WEB, 'issues', 'open').total).toBeNull();

    tab.clear();
    tab.browsed.hold(WEB);
    tab.browsed.show(VIEW);
    await tab.session.clock.advance(0);
    expect(tab.asked()).toEqual(['RepositoryIssues OPEN']);
});

interface FakePage {
    readonly nodes: readonly (IssueFieldsFragment | PullRequestFieldsFragment)[];
    readonly next: string | null;
    readonly total: number;
}

interface AddPageOptions {
    readonly next?: string;
    readonly total?: number;
    /** The repository's name as GitHub has it: the rows are made anew with it. */
    readonly owner?: string;
}

/** What the fake GitHub holds of the browsed repository. */
function createWorld() {
    const pages = new Map<string, FakePage>();
    const world = {
        nodes: new Map<string, IssueFieldsFragment | PullRequestFieldsFragment>(),
        check: (): TestRestAnswer => ({ status: 304 }),
        repositoryMissing: false,
        failing: false,
        searchRefused: false,
        searchFailing: false,
        /** A page, under what {@link describe} calls its request. */
        addPage(request: string, nodes: FakePage['nodes'], options: AddPageOptions = {}) {
            const { owner } = options;
            pages.set(request, {
                nodes: owner
                    ? nodes.map(node => ({ ...node, repository: { ...node.repository, nameWithOwner: owner } }))
                    : nodes,
                next: options.next ?? null,
                total: options.total ?? nodes.length,
            });
        },
        answer(request: TestGraphQLRequest): TestGraphQLAnswer | undefined {
            if (world.failing) {
                return undefined;
            }

            const { operation, variables } = request;
            if (operation === 'RepositoryIssues' || operation === 'RepositoryPullRequests') {
                if (world.repositoryMissing) {
                    return {
                        data: { repository: null },
                        errors: [{ type: 'NOT_FOUND', path: ['repository'], message: 'Could not resolve' }],
                    };
                }

                const page = pages.get(describe(request)) ?? { nodes: [], next: null, total: 0 };
                const connection = {
                    totalCount: page.total,
                    pageInfo: { hasNextPage: page.next !== null, endCursor: page.next },
                    nodes: page.nodes,
                };
                const field = operation === 'RepositoryIssues' ? 'issues' : 'pullRequests';
                return { data: { repository: { [field]: connection } } };
            }

            if (operation === 'ItemsByIds' && Array.isArray(variables.ids)) {
                return { data: { nodes: variables.ids.map(id => world.nodes.get(String(id)) ?? null) } };
            }

            return { data: { nodes: [] } };
        },
        answerRest(request: TestGraphQLRequest): TestRestAnswer | undefined {
            if (request.operation === 'GET /search/issues') {
                if (world.searchFailing) {
                    return undefined;
                }

                return world.searchRefused
                    ? { status: 429, body: { message: 'API rate limit exceeded' } }
                    : { status: 200, body: { total_count: 0, incomplete_results: false, items: [] } };
            }

            return world.failing ? undefined : world.check();
        },
    };

    return world;
}

/** A GitHub whose "my work" does not arrive: nothing is cleaned up, as in the moments after a reload. */
function quietWorld() {
    const world = createWorld();
    world.searchFailing = true;
    return world;
}

interface OpenTabOptions {
    readonly login?: string;
    readonly persistence?: IndexedDbPersistence;
    readonly tabs?: TestTabs;
    readonly world?: ReturnType<typeof createWorld>;
    /** The `localStorage` of an earlier session, as a reloaded tab finds it. */
    readonly localStorage?: Map<string, string>;
    /** The screen's hold of the repository, which a test of holds takes itself. */
    readonly holding?: boolean;
}

/** A tab with the real services over the fake GitHub, whose sync loops have settled. */
async function openTab(options: OpenTabOptions = {}) {
    const login = options.login ?? uniqueLogin();
    const world = options.world ?? createWorld();
    const session = createTestSession({
        login,
        answer: request => world.answer(request),
        answerRest: request => world.answerRest(request),
        tabs: options.tabs,
        localStorage: options.localStorage,
    });
    setIndexedDbPersistence(session.container, options.persistence);
    const items = session.container.resolve(ItemStore);
    const tracking = session.container.resolve(TrackingStore);
    const browsed = session.container.resolve(BrowsedRepositories);
    await items.ready();
    await tracking.ready();
    if (options.holding !== false) {
        browsed.hold(WEB);
    }

    await session.clock.advance(0);
    session.github.requests.length = 0;

    return {
        login,
        session,
        world,
        items,
        tracking,
        browsed,
        /** What was asked about browsed repositories, in order: the sync loops' own requests left out. */
        asked: () => session.github.requests.filter(isBrowsedRequest).map(describe),
        checks: () => session.github.requests.filter(request => request.operation.startsWith('GET /repos/')),
        clear: () => {
            session.github.requests.length = 0;
        },
    };
}

function isBrowsedRequest({ operation }: TestGraphQLRequest) {
    return (
        operation.startsWith('GET /repos/') ||
        operation === 'RepositoryIssues' ||
        operation === 'RepositoryPullRequests' ||
        operation === 'ItemsByIds'
    );
}

/** `<operation> <states> [after <cursor>]`, `ItemsByIds <ids>`, or the REST path. */
function describe({ operation, variables }: TestGraphQLRequest) {
    if (operation === 'ItemsByIds') {
        return `ItemsByIds ${Array.isArray(variables.ids) ? variables.ids.join(',') : ''}`;
    }

    if (operation.startsWith('GET ')) {
        return operation;
    }

    const states = Array.isArray(variables.states) ? variables.states.join(',') : '';
    return `${operation} ${states}${typeof variables.after === 'string' ? ` after ${variables.after}` : ''}`;
}

function issue(id: string, number: number, updatedAt = EARLIER, repository = WEB) {
    return sampleIssueNode(id, { repository, number, updatedAt });
}

function pullRequest(id: string, number: number, repository = WEB) {
    return samplePullRequestNode(id, { repository, number, updatedAt: EARLIER });
}

function row(node: IssueFieldsFragment) {
    const item = toItem(node);
    if (!item) {
        throw new Error('Not a row');
    }

    return item;
}

function uniqueLogin() {
    return `user-${crypto.randomUUID()}`;
}
