/// <reference types="bun" />
// IndexedDB for bun; every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, spyOn, test } from 'bun:test';

import { createPromise } from '@nzyme/utils/createPromise.js';

import { AccountSession } from '@/auth/AccountSession.js';
import { GitHubRestFactory } from '@/services/GitHubRestFactory.js';
import type { IndexedDbPersistence } from '@/store/IndexedDbPersistence.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Freshness } from '@/sync/Freshness.js';
import { SyncEngine } from '@/sync/SyncEngine.js';
import { TabChannel } from '@/sync/TabChannel.js';
import type { TrackingSyncContext } from '@/sync/TrackingSync.js';
import type { ActionsWorldRun } from '@/testing/createActionsWorld.js';
import type { TestGraphQLRequest } from '@/testing/createTestSession.js';
import { createTestSession, TEST_START } from '@/testing/createTestSession.js';
import { createTestTabs } from '@/testing/createTestTabs.js';
import type { TestTabs } from '@/testing/createTestTabs.js';
import { createTrackingWorld } from '@/testing/createTrackingWorld.js';
import type { TrackingWorld } from '@/testing/createTrackingWorld.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import type { TrackingChoice } from '@/tracking/TrackingStore.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { WorkflowStore } from './WorkflowStore.js';
import { WorkflowSync } from './WorkflowSync.js';

const TRACK_BOTH: TrackingChoice = {
    repositories: [
        { nameWithOwner: 'acme/web', id: 'R_web' },
        { nameWithOwner: 'acme/api', id: 'R_api' },
    ],
    projects: [],
};

/** The workflows' loop's interval while the tab is shown (actions D2). */
const WORKFLOWS_INTERVAL = 180_000;

const DEPLOY = 1;
const CI = 2;
const RETIRED = 3;
const RELEASE = 4;

test('the first read: the latest runs, the default branch, the workflows, the tags, and each active workflow’s runs on the default branch', async () => {
    const world = sampleWorld();
    const { session, tracking, workflows } = await setup(world);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(0);

    expect(actionsRequests(session.github.requests)).toEqual([
        'GET /repos/acme/web/actions/runs per_page=10',
        'GET /repos/acme/web',
        'GET /repos/acme/web/actions/workflows per_page=100',
        'GET /repos/acme/web/git/matching-refs/tags',
        `GET /repos/acme/web/actions/workflows/${DEPLOY}/runs branch=main per_page=10`,
        `GET /repos/acme/web/actions/workflows/${CI}/runs branch=main per_page=10`,
        'GET /repos/acme/api/actions/runs per_page=10',
        'GET /repos/acme/api',
        'GET /repos/acme/api/actions/workflows per_page=100',
        'GET /repos/acme/api/git/matching-refs/tags',
    ]);

    // Deploy failed on main; CI passed there (its failure on a pull request's branch does not count); the retired
    // one is turned off and is not read.
    const web = workflows.getState('acme/web');
    expect(web.status).toBe('read');
    expect(web.workflows.map(entry => [entry.workflow.name, entry.state])).toEqual([
        ['Deploy', 'broken'],
        ['CI', 'passing'],
        ['Retired', 'disabled'],
    ]);
    expect(workflows.getState('acme/api')).toMatchObject({ status: 'read', workflows: [], brokenCount: 0 });
    expect(workflows.totals).toEqual({ brokenCount: 1, hasNewBreak: true, hasUnread: false });
    expect(workflows.repositories.map(entry => [entry.nameWithOwner, entry.state.brokenCount])).toEqual([
        ['acme/web', 1],
        ['acme/api', 0],
    ]);
});

test('while nothing moves a poll costs three free requests per repository and writes nothing — here, on disk or to other tabs; on a change every active workflow is asked, the unchanged ones for free', async () => {
    const world = sampleWorld();
    const { session, tracking, workflows, sync, persistence } = await setup(world);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(0);
    const before = storedOf(workflows, 'acme/web');
    const saved = spyOn(persistence, 'saveWorkflows');
    const published = spyOn(session.container.resolve(TabChannel), 'publish');

    session.github.requests.length = 0;
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(actionsRequests(session.github.requests)).toEqual([
        'GET /repos/acme/web/actions/runs per_page=10 conditional',
        'GET /repos/acme/web conditional',
        'GET /repos/acme/web/actions/workflows per_page=100 conditional',
        'GET /repos/acme/api/actions/runs per_page=10 conditional',
        'GET /repos/acme/api conditional',
        'GET /repos/acme/api/actions/workflows per_page=100 conditional',
    ]);
    expect(storedOf(workflows, 'acme/web')).toBe(before);
    expect(saved).not.toHaveBeenCalled();
    expect(published.mock.calls.filter(([message]) => message.kind === 'workflows')).toEqual([]);
    expect(sync.getWorkflowsFreshness()).toEqual({ kind: 'fresh', checkedAt: TEST_START + WORKFLOWS_INTERVAL });

    // Deploy runs again on main and passes: the tags and every active workflow are asked, conditionally, and the
    // unchanged answer 304.
    world.actions.repository('acme/web').runs.push(run(20, DEPLOY, 'success', '2026-10-30T13:01:00Z'));
    session.github.requests.length = 0;
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(actionsRequests(session.github.requests)).toEqual([
        'GET /repos/acme/web/actions/runs per_page=10 conditional',
        'GET /repos/acme/web conditional',
        'GET /repos/acme/web/actions/workflows per_page=100 conditional',
        'GET /repos/acme/web/git/matching-refs/tags conditional',
        `GET /repos/acme/web/actions/workflows/${DEPLOY}/runs branch=main per_page=10 conditional`,
        `GET /repos/acme/web/actions/workflows/${CI}/runs branch=main per_page=10 conditional`,
        'GET /repos/acme/api/actions/runs per_page=10 conditional',
        'GET /repos/acme/api conditional',
        'GET /repos/acme/api/actions/workflows per_page=100 conditional',
    ]);
    expect(workflows.getState('acme/web').workflows[0]).toMatchObject({ state: 'passing' });
    expect(workflows.totals.brokenCount).toBe(0);
});

test('a broken workflow disabled on GitHub, or a renamed default branch, with no run since, is noticed at the next poll', async () => {
    const world = sampleWorld();
    const actions = world.actions.repository('acme/web');
    const { session, tracking, workflows } = await setup(world);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(0);
    expect(workflows.totals.brokenCount).toBe(1);

    // Deploy is turned off on github.com: no run moves, only the workflow list.
    actions.workflows = actions.workflows.map(workflow =>
        workflow.id === DEPLOY ? { ...workflow, state: 'disabled_manually' } : workflow,
    );
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(stateOf(workflows, 'acme/web')).toEqual([
        ['Deploy', 'disabled'],
        ['CI', 'passing'],
        ['Retired', 'disabled'],
    ]);
    expect(workflows.totals.brokenCount).toBe(0);

    // The default branch is renamed: no run counts on it yet.
    actions.defaultBranch = 'trunk';
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(workflows.get('acme/web')).toMatchObject({ defaultBranch: 'trunk' });
    expect(stateOf(workflows, 'acme/web')).toEqual([
        ['Deploy', 'disabled'],
        ['CI', 'unknown'],
        ['Retired', 'disabled'],
    ]);
});

test('a run that finished after newer runs pushed it out of the latest runs is still read', async () => {
    const world = sampleWorld();
    const actions = world.actions.repository('acme/web');
    // Deploy passed, and runs again.
    actions.runs.push(run(29, DEPLOY, 'success', '2026-10-30T11:30:00Z'));
    actions.runs.push(run(30, DEPLOY, null, '2026-10-30T12:00:00Z'));
    const { session, tracking, workflows } = await setup(world);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(0);
    expect(workflows.getState('acme/web').workflows[0]).toMatchObject({ state: 'passing' });

    // It fails, while ten runs on pull requests' branches fill the latest runs.
    actions.runs = actions.runs.map(entry =>
        entry.id === 30 ? { ...entry, status: 'completed', conclusion: 'failure' } : entry,
    );
    for (let id = 40; id < 50; id++) {
        actions.runs.push(
            run(id, CI, 'success', `2026-10-30T13:${String(id).padStart(2, '0')}:00Z`, { headBranch: 'feature' }),
        );
    }

    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(workflows.getState('acme/web').workflows[0]).toMatchObject({ state: 'broken' });
});

test('a workflow gone from GitHub’s list goes; one with only cancelled runs on its first page is read further back, three pages at most', async () => {
    const world = sampleWorld();
    const actions = world.actions.repository('acme/web');
    // A row of cancelled runs after a failure: the failure is on the second page.
    for (let id = 100; id < 112; id++) {
        actions.runs.push(run(id, DEPLOY, 'cancelled', `2026-10-30T12:${String(id - 100).padStart(2, '0')}:00Z`));
    }

    // Never a verdict: three pages, then no more.
    actions.workflows.push({ id: 4, name: 'Nightly', state: 'active' });
    for (let id = 200; id < 240; id++) {
        actions.runs.push(
            run(
                id,
                4,
                'skipped',
                `2026-10-29T${String(Math.floor((id - 200) / 2)).padStart(2, '0')}:${id % 2 === 0 ? '00' : '30'}:00Z`,
            ),
        );
    }

    const { session, tracking, workflows } = await setup(world);
    tracking.choose({ ...TRACK_BOTH, repositories: [{ nameWithOwner: 'acme/web', id: 'R_web' }] });
    await session.clock.advance(0);

    const requests = actionsRequests(session.github.requests);
    expect(requests.filter(request => request.includes(`/workflows/${DEPLOY}/runs`))).toEqual([
        `GET /repos/acme/web/actions/workflows/${DEPLOY}/runs branch=main per_page=10`,
        `GET /repos/acme/web/actions/workflows/${DEPLOY}/runs branch=main per_page=10 page=2`,
    ]);
    expect(requests.filter(request => request.includes('/workflows/4/runs'))).toEqual([
        'GET /repos/acme/web/actions/workflows/4/runs branch=main per_page=10',
        'GET /repos/acme/web/actions/workflows/4/runs branch=main per_page=10 page=2',
        'GET /repos/acme/web/actions/workflows/4/runs branch=main per_page=10 page=3',
    ]);
    expect(stateOf(workflows, 'acme/web')).toEqual([
        ['Deploy', 'broken'],
        ['CI', 'passing'],
        ['Retired', 'disabled'],
        ['Nightly', 'unknown'],
    ]);

    // Nightly's file is deleted, with its runs, and CI runs again: Nightly leaves the list.
    actions.workflows = actions.workflows.filter(workflow => workflow.id !== 4);
    actions.runs = actions.runs.filter(entry => entry.workflowId !== 4);
    actions.runs.push(run(20, CI, 'success', '2026-10-30T13:01:00Z'));
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(stateOf(workflows, 'acme/web')).toEqual([
        ['Deploy', 'broken'],
        ['CI', 'passing'],
        ['Retired', 'disabled'],
    ]);
});

test('with a pattern, each active workflow’s runs on any ref are read too — paging back on the first read until the pattern has a verdict — and a failure on a tag counts', async () => {
    const world = sampleWorld();
    const actions = world.actions.repository('acme/web');
    actions.tags = ['v1.0-rc.1'];
    actions.workflows.push({ id: RELEASE, name: 'Release', state: 'active' });
    actions.runs.push(run(60, RELEASE, 'failure', '2026-10-29T00:00:00Z', { headBranch: 'v1.0-rc.1' }));
    // Its runs on pull requests' branches fill the first page of its runs on any ref.
    for (let id = 300; id < 340; id++) {
        actions.runs.push(
            run(
                id,
                RELEASE,
                'success',
                `2026-10-29T${String(Math.floor((id - 300) / 2) + 1).padStart(2, '0')}:00:00Z`,
                {
                    headBranch: 'feature',
                    event: 'pull_request',
                },
            ),
        );
    }

    const { session, tracking, workflows } = await setup(world);
    tracking.choose(TRACK_BOTH);
    tracking.setWorkflowSettings('acme/web', { defaultBranch: true, refs: ['v*'] });
    await session.clock.advance(0);

    const releaseRuns = (requests: readonly string[]) => requests.filter(request => request.includes('/workflows/4/'));
    expect(releaseRuns(actionsRequests(session.github.requests))).toEqual([
        'GET /repos/acme/web/actions/workflows/4/runs branch=main per_page=10',
        'GET /repos/acme/web/actions/workflows/4/runs per_page=30',
        'GET /repos/acme/web/actions/workflows/4/runs per_page=30 page=2',
    ]);
    const release = workflows.getState('acme/web').workflows.find(entry => entry.workflow.id === RELEASE);
    expect(release).toMatchObject({ state: 'broken' });
    expect(release?.brokenGroups.map(group => [group.group, group.failedRef])).toEqual([
        [
            { kind: 'pattern', pattern: 'v*' },
            { name: 'v1.0-rc.1', kind: 'tag' },
        ],
    ]);
    expect(workflows.get('acme/web')?.tags).toEqual(['v1.0-rc.1']);
    expect(workflows.totals.brokenCount).toBe(2);

    // Another pull request run: read from the first page on, the deciding failure kept however far back.
    actions.runs.push(
        run(400, RELEASE, 'success', '2026-10-31T00:00:00Z', { headBranch: 'feature', event: 'pull_request' }),
    );
    session.github.requests.length = 0;
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(releaseRuns(actionsRequests(session.github.requests))).toEqual([
        'GET /repos/acme/web/actions/workflows/4/runs branch=main per_page=10 conditional',
        'GET /repos/acme/web/actions/workflows/4/runs per_page=30 conditional',
    ]);
    expect(workflows.getState('acme/web').workflows.find(entry => entry.workflow.id === RELEASE)?.state).toBe('broken');

    // The tag's release passes: the group heals, the default branch's never had a run.
    actions.runs.push(run(401, RELEASE, 'success', '2026-10-31T01:00:00Z', { headBranch: 'v1.0-rc.2' }));
    actions.tags = [...actions.tags, 'v1.0-rc.2'];
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(
        workflows
            .getState('acme/web')
            .workflows.find(entry => entry.workflow.id === RELEASE)
            ?.groups.map(group => group.state),
    ).toEqual(['unknown', 'passing']);
    expect(workflows.get('acme/web')?.tags).toEqual(['v1.0-rc.1', 'v1.0-rc.2']);
});

test('a changed setting applies at once to what is stored, and a pattern added is read at the next poll though nothing moved on GitHub', async () => {
    const world = sampleWorld();
    const { session, tracking, workflows } = await setup(world);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(0);
    expect(workflows.totals.brokenCount).toBe(1);

    tracking.setWorkflowSettings('acme/web', { defaultBranch: false, refs: [] });
    expect(stateOf(workflows, 'acme/web')).toEqual([
        ['Deploy', 'unknown'],
        ['CI', 'unknown'],
        ['Retired', 'disabled'],
    ]);
    expect(workflows.totals.brokenCount).toBe(0);

    tracking.setWorkflowSettings('acme/web', { defaultBranch: true, refs: ['v*'] });
    expect(workflows.totals.brokenCount).toBe(1);
    session.github.requests.length = 0;
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(actionsRequests(session.github.requests)).toEqual([
        'GET /repos/acme/web/actions/runs per_page=10 conditional',
        'GET /repos/acme/web conditional',
        'GET /repos/acme/web/actions/workflows per_page=100 conditional',
        'GET /repos/acme/web/git/matching-refs/tags conditional',
        `GET /repos/acme/web/actions/workflows/${DEPLOY}/runs branch=main per_page=10 conditional`,
        `GET /repos/acme/web/actions/workflows/${DEPLOY}/runs per_page=30`,
        `GET /repos/acme/web/actions/workflows/${CI}/runs branch=main per_page=10 conditional`,
        `GET /repos/acme/web/actions/workflows/${CI}/runs per_page=30`,
        'GET /repos/acme/api/actions/runs per_page=10 conditional',
        'GET /repos/acme/api conditional',
        'GET /repos/acme/api/actions/workflows per_page=100 conditional',
    ]);

    // Read once: the next poll with nothing moved is free again.
    session.github.requests.length = 0;
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(actionsRequests(session.github.requests)).toHaveLength(6);
});

test('a screen with a repository’s runs on any ref has them read at once and at every poll, which count nowhere unless a pattern says so; let go, the regular poll does not ask them', async () => {
    const world = sampleWorld();
    const { session, tracking, workflows, sync, persistence } = await setup(world);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(10_000);

    session.github.requests.length = 0;
    const release = sync.watchAnyRef('acme/web');
    await session.clock.advance(0);
    expect(actionsRequests(session.github.requests)).toEqual([
        'GET /repos/acme/web/actions/runs per_page=10 conditional',
        'GET /repos/acme/web conditional',
        'GET /repos/acme/web/actions/workflows per_page=100 conditional',
        'GET /repos/acme/web/git/matching-refs/tags conditional',
        `GET /repos/acme/web/actions/workflows/${DEPLOY}/runs branch=main per_page=10 conditional`,
        `GET /repos/acme/web/actions/workflows/${DEPLOY}/runs per_page=30`,
        `GET /repos/acme/web/actions/workflows/${CI}/runs branch=main per_page=10 conditional`,
        `GET /repos/acme/web/actions/workflows/${CI}/runs per_page=30`,
        'GET /repos/acme/api/actions/runs per_page=10 conditional',
        'GET /repos/acme/api conditional',
        'GET /repos/acme/api/actions/workflows per_page=100 conditional',
    ]);
    // CI's failure on a pull request's branch is kept for the tab, and counts nowhere.
    const ci = workflows.get('acme/web')?.workflows.find(entry => entry.workflow.id === CI);
    expect(ci?.runs.map(entry => entry.id)).toEqual([4, 3]);
    expect(stateOf(workflows, 'acme/web')).toEqual([
        ['Deploy', 'broken'],
        ['CI', 'passing'],
        ['Retired', 'disabled'],
    ]);

    // Still on screen: the next poll asks them again, free while they did not move, and writes nothing.
    const before = storedOf(workflows, 'acme/web');
    const saved = spyOn(persistence, 'saveWorkflows');
    session.github.requests.length = 0;
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(actionsRequests(session.github.requests)).toContain(
        `GET /repos/acme/web/actions/workflows/${CI}/runs per_page=30 conditional`,
    );
    expect(storedOf(workflows, 'acme/web')).toBe(before);
    expect(saved).not.toHaveBeenCalled();

    release();
    session.github.requests.length = 0;
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(actionsRequests(session.github.requests)).toHaveLength(6);
});

test('a repository on screen sees a new failure on another ref, and a pull request’s run finishing, at the next poll', async () => {
    const world = sampleWorld();
    const actions = world.actions.repository('acme/web');
    actions.runs.push(run(6, CI, null, '2026-10-30T12:00:00Z', { headBranch: 'feature', event: 'pull_request' }));
    const { session, tracking, workflows, sync } = await setup(world);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(10_000);
    sync.watchAnyRef('acme/web');
    await session.clock.advance(0);
    const ciRuns = () => workflows.get('acme/web')?.workflows.find(entry => entry.workflow.id === CI)?.runs;
    expect(ciRuns()?.find(entry => entry.id === 6)).toMatchObject({ status: 'in_progress' });

    actions.runs = actions.runs.map(entry =>
        entry.id === 6 ? { ...entry, status: 'completed', conclusion: 'success' } : entry,
    );
    actions.runs.push(run(7, CI, 'failure', '2026-10-30T13:00:00Z', { headBranch: 'v1.0' }));
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(ciRuns()?.find(entry => entry.id === 6)).toMatchObject({ status: 'completed', conclusion: 'success' });
    expect(ciRuns()?.[0]).toMatchObject({ id: 7, headBranch: 'v1.0', conclusion: 'failure' });
});

test('a repository on screen before the sync starts has its runs on any ref read by the first poll', async () => {
    const world = sampleWorld();
    const login = uniqueLogin();
    const first = await setup(world, { login });
    first.tracking.choose(TRACK_BOTH);
    await first.session.clock.advance(0);

    // A reload at the address of the Workflows section: the screen is there before the kept copy is read.
    const second = await setup(world, {
        login,
        persistence: first.persistence,
        localStorage: first.session.localStorage,
        beforeSync: sync => {
            sync.watchAnyRef('acme/web');
        },
    });
    expect(actionsRequests(second.session.github.requests)).toContain(
        `GET /repos/acme/web/actions/workflows/${CI}/runs per_page=30`,
    );
    const ci = second.workflows.get('acme/web')?.workflows.find(entry => entry.workflow.id === CI);
    expect(ci?.runs.map(entry => entry.id)).toEqual([4, 3]);
});

test('a failed poll loses nothing: the repository on screen has its runs on any ref read by the next one', async () => {
    const world = sampleWorld();
    const { session, tracking, sync, items } = await setup(world);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(10_000);

    world.failing.add('GET /repos/acme/web/actions/runs');
    sync.watchAnyRef('acme/web');
    await session.clock.advance(0);
    expect(items.getSyncState('workflows').lastError).toEqual(expect.any(String));

    world.failing.clear();
    session.github.requests.length = 0;
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(actionsRequests(session.github.requests)).toContain(
        `GET /repos/acme/web/actions/workflows/${CI}/runs per_page=30`,
    );
    expect(items.getSyncState('workflows').lastError).toBeNull();
});

test('a repository coming on screen while a poll runs past it is read at the end of that poll', async () => {
    const world = sampleWorld();
    const { session, tracking, sync } = await setup(world);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(10_000);

    const held = createPromise();
    session.github.holdIf = request => (request.operation === 'GET /repos/acme/api/actions/runs' ? held.promise : null);
    session.github.requests.length = 0;
    void sync.pollNow('workflows');
    await session.clock.advance(0);
    sync.watchAnyRef('acme/web');
    held.resolve();
    await session.clock.advance(0);
    expect(actionsRequests(session.github.requests).filter(request => request.includes('per_page=30'))).toEqual([
        `GET /repos/acme/web/actions/workflows/${DEPLOY}/runs per_page=30`,
        `GET /repos/acme/web/actions/workflows/${CI}/runs per_page=30`,
    ]);
});

test('a tab that does not sync, with a repository on screen, has the syncing tab read its runs on any ref at once, until it closes', async () => {
    const world = sampleWorld();
    const browser = createTestTabs();
    const login = uniqueLogin();
    const syncing = await setup(world, { login, tabs: browser });
    const persistence = syncing.persistence;
    syncing.tracking.choose(TRACK_BOTH);
    await syncing.session.clock.advance(10_000);
    const other = await setup(world, {
        login,
        tabs: browser,
        persistence,
        localStorage: syncing.session.localStorage,
    });
    await syncing.session.clock.advance(0);

    syncing.session.github.requests.length = 0;
    other.sync.watchAnyRef('acme/web');
    await syncing.session.clock.advance(0);
    await other.session.clock.advance(0);
    await syncing.session.clock.advance(0);
    expect(actionsRequests(syncing.session.github.requests)).toContain(
        `GET /repos/acme/web/actions/workflows/${CI}/runs per_page=30`,
    );

    // Still there, saying so every heartbeat: asked again at the next poll.
    syncing.session.github.requests.length = 0;
    for (let elapsed = 0; elapsed < WORKFLOWS_INTERVAL; elapsed += 30_000) {
        await other.session.clock.advance(30_000);
        await syncing.session.clock.advance(30_000);
    }

    expect(actionsRequests(syncing.session.github.requests)).toContain(
        `GET /repos/acme/web/actions/workflows/${CI}/runs per_page=30 conditional`,
    );

    other.session.tab.close();
    await syncing.session.clock.advance(0);
    syncing.session.github.requests.length = 0;
    await syncing.session.clock.advance(WORKFLOWS_INTERVAL);
    expect(actionsRequests(syncing.session.github.requests)).toHaveLength(6);
});

test('the first read shows as it goes: the list and the default branch at once, a workflow at a time, nothing passing or lowering the total before its runs are in', async () => {
    const world = sampleWorld();
    const { session, tracking, workflows } = await setup(world);
    const heldCi = createPromise();
    session.github.holdIf = request =>
        request.operation === `GET /repos/acme/web/actions/workflows/${CI}/runs` ? heldCi.promise : null;
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(0);

    expect(workflows.get('acme/web')).toMatchObject({ defaultBranch: 'main', runsEtag: null, workflowsEtag: null });
    expect(workflows.getReadProgress('acme/web')).toEqual({ read: 1, total: 2 });
    expect(workflows.getState('acme/web')).toMatchObject({ status: 'read', reading: true, brokenCount: 1 });
    expect(stateOf(workflows, 'acme/web')).toEqual([
        ['Deploy', 'broken'],
        ['CI', 'unknown'],
        ['Retired', 'disabled'],
    ]);
    expect(workflows.totals).toMatchObject({ brokenCount: 1, hasUnread: true });

    heldCi.resolve();
    await session.clock.advance(0);
    expect(workflows.getReadProgress('acme/web')).toBeNull();
    expect(workflows.getState('acme/web')).toMatchObject({ reading: false, brokenCount: 1 });
    expect(stateOf(workflows, 'acme/web')).toEqual([
        ['Deploy', 'broken'],
        ['CI', 'passing'],
        ['Retired', 'disabled'],
    ]);
    expect(workflows.totals).toEqual({ brokenCount: 1, hasNewBreak: true, hasUnread: false });
});

test('a first read cut short goes on from what it stored at the next poll, though nothing changed on GitHub', async () => {
    const world = sampleWorld();
    world.failing.add(`GET /repos/acme/web/actions/workflows/${CI}/runs`);
    const { session, tracking, workflows } = await setup(world);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(0);
    expect(workflows.getReadProgress('acme/web')).toEqual({ read: 1, total: 2 });

    world.failing.clear();
    session.github.requests.length = 0;
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(actionsRequests(session.github.requests)).toContain(
        `GET /repos/acme/web/actions/workflows/${CI}/runs branch=main per_page=10`,
    );
    expect(workflows.getReadProgress('acme/web')).toBeNull();
    expect(stateOf(workflows, 'acme/web')).toEqual([
        ['Deploy', 'broken'],
        ['CI', 'passing'],
        ['Retired', 'disabled'],
    ]);
    expect(workflows.get('acme/web')?.runsEtag).not.toBeNull();
});

test('a repository whose Actions GitHub refuses or turned off is said so without failing the loop, and asked again at every poll', async () => {
    const world = sampleWorld();
    world.actions.repository('acme/web').refusal = 403;
    world.actions.repository('acme/api').refusal = 404;
    const { session, tracking, workflows, sync, items } = await setup(world);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(0);

    expect(workflows.get('acme/web')?.unavailable).toEqual({ reason: 'refused', status: 403 });
    expect(workflows.get('acme/api')?.unavailable).toEqual({ reason: 'disabled', status: 404 });
    expect(workflows.getState('acme/web')).toMatchObject({ status: 'unavailable', brokenCount: 0 });
    expect(workflows.totals).toMatchObject({ brokenCount: 0 });
    expect(items.getSyncState('workflows').lastError).toBeNull();
    expect(sync.getWorkflowsFreshness().kind).toBe('fresh');

    session.github.requests.length = 0;
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(actionsRequests(session.github.requests)).toEqual([
        'GET /repos/acme/web/actions/runs per_page=10',
        'GET /repos/acme/api/actions/runs per_page=10',
    ]);
    expect(workflows.get('acme/web')?.unavailable).toEqual({ reason: 'refused', status: 403 });

    // Turned on again: read at the next poll.
    world.actions.repository('acme/web').refusal = null;
    world.actions.repository('acme/api').refusal = null;
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(workflows.getState('acme/web')).toMatchObject({ status: 'read', brokenCount: 1 });
    expect(workflows.getState('acme/api').status).toBe('read');
});

test('GitHub failing for one repository fails the loop once the others are read; a revoked token fails it at once', async () => {
    const world = sampleWorld();
    world.failing.add('GET /repos/acme/web/actions/runs');
    const { session, tracking, workflows, items } = await setup(world);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(0);

    expect(workflows.getState('acme/web').status).toBe('unread');
    expect(workflows.getState('acme/api').status).toBe('read');
    expect(workflows.totals.hasUnread).toBe(true);
    expect(items.getSyncState('workflows').lastError).toEqual(expect.any(String));

    // The token is no longer good: the poll stops at the first repository.
    world.failing.clear();
    world.actions.repository('acme/web').refusal = 401;
    session.github.requests.length = 0;
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(actionsRequests(session.github.requests)).toEqual(['GET /repos/acme/web/actions/runs per_page=10']);
    expect(workflows.getState('acme/web').status).toBe('unread');
    expect(items.getSyncState('workflows').lastError).toEqual(expect.any(String));
});

test('after a break in polling, a failure on a pattern’s ref behind 30 pull request runs is found, as a rebuilt cache would find it; regular polls ask one page', async () => {
    const world = sampleWorld();
    const actions = world.actions.repository('acme/web');
    actions.workflows.push({ id: RELEASE, name: 'Release', state: 'active' });
    actions.runs.push(run(60, RELEASE, 'success', '2026-10-28T00:00:00Z', { headBranch: 'release/2' }));
    const { session, tracking, workflows } = await setup(world);
    tracking.choose(TRACK_BOTH);
    tracking.setWorkflowSettings('acme/web', { defaultBranch: true, refs: ['release/*'] });
    await session.clock.advance(0);
    const release = () => workflows.getState('acme/web').workflows.find(entry => entry.workflow.id === RELEASE);
    expect(release()?.state).toBe('passing');

    // Over the weekend, with githq closed.
    actions.runs.push(run(61, RELEASE, 'failure', '2026-10-31T00:00:00Z', { headBranch: 'release/2' }));
    pushPullRequestRuns(actions.runs, 700, 35, '2026-11-01');
    session.github.requests.length = 0;
    await session.clock.advance(WORKFLOWS_INTERVAL);

    expect(releaseAnyRefRequests(session.github.requests)).toEqual([
        'GET /repos/acme/web/actions/workflows/4/runs per_page=30 conditional',
        'GET /repos/acme/web/actions/workflows/4/runs per_page=30 page=2',
    ]);
    expect(release()).toMatchObject({ state: 'broken', latestFailedRun: { id: 61 } });

    // Polled regularly again: the first page reaches what is stored.
    pushPullRequestRuns(actions.runs, 800, 2, '2026-11-02');
    session.github.requests.length = 0;
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(releaseAnyRefRequests(session.github.requests)).toEqual([
        'GET /repos/acme/web/actions/workflows/4/runs per_page=30 conditional',
    ]);
});

test('after a break in polling, a pass on a pattern’s ref behind 30 pull request runs heals what stored as broken', async () => {
    const world = sampleWorld();
    const actions = world.actions.repository('acme/web');
    actions.workflows.push({ id: RELEASE, name: 'Release', state: 'active' });
    actions.runs.push(run(60, RELEASE, 'failure', '2026-10-28T00:00:00Z', { headBranch: 'v1.0-rc.2' }));
    const { session, tracking, workflows } = await setup(world);
    tracking.choose(TRACK_BOTH);
    tracking.setWorkflowSettings('acme/web', { defaultBranch: true, refs: ['v*'] });
    await session.clock.advance(0);
    const release = () => workflows.getState('acme/web').workflows.find(entry => entry.workflow.id === RELEASE);
    expect(release()?.state).toBe('broken');

    actions.runs.push(run(61, RELEASE, 'success', '2026-10-31T00:00:00Z', { headBranch: 'v1.0-rc.3' }));
    pushPullRequestRuns(actions.runs, 700, 35, '2026-11-01');
    await session.clock.advance(WORKFLOWS_INTERVAL);

    expect(release()?.state).toBe('passing');
});

test('after a break in polling, a failure on the default branch behind a page of cancelled runs is found', async () => {
    const world = sampleWorld();
    const actions = world.actions.repository('acme/web');
    const { session, tracking, workflows } = await setup(world);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(0);
    const ci = () => workflows.getState('acme/web').workflows.find(entry => entry.workflow.id === CI);
    expect(ci()?.state).toBe('passing');

    actions.runs.push(run(61, CI, 'failure', '2026-10-31T00:00:00Z'));
    for (let id = 700; id < 712; id++) {
        actions.runs.push(run(id, CI, 'cancelled', `2026-11-01T${String(id - 700).padStart(2, '0')}:00:00Z`));
    }

    await session.clock.advance(WORKFLOWS_INTERVAL);

    expect(ci()).toMatchObject({ state: 'broken', latestFailedRun: { id: 61 } });
});

test('a fresh run on the default branch read in the same poll does not stop the any-ref read short of what it missed', async () => {
    const world = sampleWorld();
    const actions = world.actions.repository('acme/web');
    actions.workflows.push({ id: RELEASE, name: 'Release', state: 'active' });
    actions.runs.push(run(60, RELEASE, 'success', '2026-10-28T00:00:00Z', { headBranch: 'release/2' }));
    const { session, tracking, workflows } = await setup(world);
    tracking.choose(TRACK_BOTH);
    tracking.setWorkflowSettings('acme/web', { defaultBranch: true, refs: ['release/*'] });
    await session.clock.advance(0);

    actions.runs.push(run(61, RELEASE, 'failure', '2026-10-31T00:00:00Z', { headBranch: 'release/2' }));
    pushPullRequestRuns(actions.runs, 700, 35, '2026-11-01');
    // Newer than the oldest run of the any-ref page: stored by the branch's read just before it.
    actions.runs.push(run(62, RELEASE, 'success', '2026-11-01T20:00:00Z'));
    await session.clock.advance(WORKFLOWS_INTERVAL);

    const release = workflows.getState('acme/web').workflows.find(entry => entry.workflow.id === RELEASE);
    expect(release?.brokenGroups.map(group => group.latestFailedRun?.id)).toEqual([61]);
});

test('the Workflows section’s freshness: the first read’s progress, then the workflows’ own poll', async () => {
    const world = sampleWorld();
    const { session, tracking, sync } = await setup(world);
    const heldCi = createPromise();
    session.github.holdIf = request =>
        request.operation === `GET /repos/acme/web/actions/workflows/${CI}/runs` ? heldCi.promise : null;
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(0);
    expect(sync.getRepositoryWorkflowsFreshness('acme/web')).toEqual({ kind: 'reading', read: 1, total: 2 });

    heldCi.resolve();
    await session.clock.advance(0);
    expect(sync.getRepositoryWorkflowsFreshness('acme/web')).toEqual(sync.getWorkflowsFreshness());
    expect(sync.getRepositoryWorkflowsFreshness('acme/web').kind).toBe('fresh');
});

test('first run and loading D14: workflows not read yet are being read — Broken workflows says how many repositories are — then as their poll goes', async () => {
    const world = sampleWorld();
    world.actions.repository('other/gone').refusal = 404;
    const { session, tracking, sync } = await setup(world);
    const heldApi = createPromise();
    session.github.holdIf = request =>
        request.operation === 'GET /repos/acme/api/actions/runs' ? heldApi.promise : null;
    // A repository GitHub shows no Actions of counts in neither.
    tracking.choose({
        projects: [],
        repositories: [
            { nameWithOwner: 'acme/web', id: 'R_web' },
            { nameWithOwner: 'other/gone', id: 'R_gone' },
            { nameWithOwner: 'acme/api', id: 'R_api' },
        ],
    });
    await session.clock.advance(0);

    expect(sync.getRepositoryWorkflowsFreshness('acme/api')).toEqual({ kind: 'partial', readingWorkflows: true });
    expect(sync.getWorkflowsFreshness()).toEqual({ kind: 'partial', readingWorkflows: { read: 1, total: 2 } });

    heldApi.resolve();
    await session.clock.advance(0);
    expect(sync.getRepositoryWorkflowsFreshness('acme/api').kind).toBe('fresh');
    expect(sync.getWorkflowsFreshness().kind).toBe('fresh');
});

test('ES23: a repository just tracked that GitHub fails on is told at once on Broken workflows, however recently the poll last succeeded', async () => {
    const world = sampleWorld();
    const { session, tracking, sync } = await setup(world);
    // Polled with nothing tracked: a success, and fresh for minutes.
    await session.clock.advance(0);
    expect(sync.getWorkflowsFreshness().kind).toBe('fresh');

    world.failing.add('GET /repos/acme/web/actions/runs');
    tracking.choose({ projects: [], repositories: [{ nameWithOwner: 'acme/web', id: 'R_web' }] });
    void sync.pollNow('workflows');
    await session.clock.advance(0);

    expect(sync.getWorkflowsFreshness()).toMatchObject({ kind: 'stale', reason: 'failing' });
});

test('Broken workflows counts a repository whose runs are still being read as not read, as its list does', async () => {
    const world = sampleWorld();
    const { session, tracking, sync, workflows } = await setup(world);
    const heldCi = createPromise();
    session.github.holdIf = request =>
        request.operation === `GET /repos/acme/web/actions/workflows/${CI}/runs` ? heldCi.promise : null;
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(0);

    expect(workflows.getState('acme/web')).toMatchObject({ status: 'read', reading: true });
    expect(sync.getWorkflowsFreshness()).toEqual({ kind: 'partial', readingWorkflows: { read: 0, total: 2 } });

    heldCi.resolve();
    await session.clock.advance(0);
    expect(sync.getWorkflowsFreshness().kind).toBe('fresh');
});

test('ES23: offline with repositories not read is told on Broken workflows and their Workflows sections, however recently the poll last succeeded', async () => {
    const world = sampleWorld();
    const { session, tracking, sync, items } = await setup(world);
    // Polled with nothing tracked: a success, and fresh for minutes.
    await session.clock.advance(0);
    const polledAt = items.getSyncState('workflows').lastSuccessAt;
    expect(sync.getWorkflowsFreshness().kind).toBe('fresh');

    session.setOnline(false);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(0);

    const offline: Freshness = { kind: 'stale', since: polledAt, reason: 'offline' };
    expect(sync.getWorkflowsFreshness()).toEqual(offline);
    expect(sync.getRepositoryWorkflowsFreshness('acme/web')).toEqual(offline);
});

test('the Workflows section’s freshness: GitHub failing during the first read says so instead of reading forever', async () => {
    const world = sampleWorld();
    world.failing.add(`GET /repos/acme/web/actions/workflows/${CI}/runs`);
    const { session, tracking, sync } = await setup(world);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(0);

    expect(sync.getRepositoryWorkflowsFreshness('acme/web').kind).not.toBe('reading');

    // A failed poll does not flicker the marker: said once the last success is overdue.
    await session.clock.advance(WORKFLOWS_INTERVAL + 60_000);
    expect(sync.getRepositoryWorkflowsFreshness('acme/web')).toMatchObject({ kind: 'stale', reason: 'failing' });
});

test('the Workflows section’s freshness: Actions refused with rows last read is stale, whatever the issues’ poll and the loop say; refused during the first read is no reading; with no rows the loop’s', async () => {
    const world = sampleWorld();
    const { session, tracking, sync } = await setup(world);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(0);

    world.actions.repository('acme/web').refusal = 403;
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(sync.getWorkflowsFreshness().kind).toBe('fresh');
    expect(sync.getRepositoryWorkflowsFreshness('acme/web')).toEqual({
        kind: 'stale',
        since: null,
        reason: 'workflowsUnavailable',
    });

    const refusedMidway = sampleWorld();
    const second = await setup(refusedMidway);
    const ci = `GET /repos/acme/web/actions/workflows/${CI}/runs`;
    second.session.github.holdIf = request => {
        if (request.operation === ci) {
            refusedMidway.actions.repository('acme/web').refusal = 403;
        }

        return null;
    };
    second.tracking.choose(TRACK_BOTH);
    await second.session.clock.advance(0);
    expect(second.workflows.get('acme/web')?.unavailable).toEqual({ reason: 'refused', status: 403 });
    expect(second.workflows.getReadProgress('acme/web')).toEqual({ read: 1, total: 2 });
    expect(second.sync.getRepositoryWorkflowsFreshness('acme/web')).toMatchObject({
        kind: 'stale',
        reason: 'workflowsUnavailable',
    });

    const neverShown = sampleWorld();
    neverShown.actions.repository('acme/web').refusal = 403;
    const third = await setup(neverShown);
    third.tracking.choose(TRACK_BOTH);
    await third.session.clock.advance(0);
    expect(third.sync.getRepositoryWorkflowsFreshness('acme/web')).toEqual(third.sync.getWorkflowsFreshness());
});

test('a used-up core allowance pauses the loop: nothing is asked of Actions until it resets', async () => {
    const world = sampleWorld();
    const { session, tracking, workflows, sync } = await setup(world);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(0);

    // A request of another loop reports the core allowance used up.
    session.github.coreRemaining = 0;
    world.actions.repository('acme/web').runs.push(run(20, DEPLOY, 'success', '2026-10-30T13:01:00Z'));
    session.github.requests.length = 0;
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(actionsRequests(session.github.requests)).toEqual([]);
    expect(sync.notice).toMatchObject({ kind: 'paused' });

    // The tab hidden meanwhile, so the other loops' polls are fewer.
    session.setVisible(false);
    await session.clock.advance(30 * 60_000);
    expect(actionsRequests(session.github.requests)).toEqual([]);
    expect(workflows.totals.brokenCount).toBe(1);

    // The reset comes: polled again.
    session.github.coreRemaining = 4900;
    await session.clock.advance(30 * 60_000);
    session.setVisible(true);
    await session.clock.advance(0);
    expect(workflows.totals.brokenCount).toBe(0);
});

test('a screen asking for a poll gets one at once, never alongside a running one', async () => {
    const world = sampleWorld();
    const { session, tracking, sync } = await setup(world);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(10_000);

    session.github.requests.length = 0;
    void sync.pollNow('workflows');
    await session.clock.advance(0);
    expect(actionsRequests(session.github.requests)).toEqual([
        'GET /repos/acme/web/actions/runs per_page=10 conditional',
        'GET /repos/acme/web conditional',
        'GET /repos/acme/web/actions/workflows per_page=100 conditional',
        'GET /repos/acme/api/actions/runs per_page=10 conditional',
        'GET /repos/acme/api conditional',
        'GET /repos/acme/api/actions/workflows per_page=100 conditional',
    ]);

    const held = createPromise();
    session.github.holdIf = request => (request.operation === 'GET /repos/acme/web/actions/runs' ? held.promise : null);
    session.github.requests.length = 0;
    void sync.pollNow('workflows');
    await session.clock.advance(0);
    void sync.pollNow('workflows');
    void sync.pollNow('workflows');
    await session.clock.advance(0);
    held.resolve();
    await session.clock.advance(0);
    expect(actionsRequests(session.github.requests)).toEqual([
        'GET /repos/acme/web/actions/runs per_page=10 conditional',
        'GET /repos/acme/web conditional',
        'GET /repos/acme/web/actions/workflows per_page=100 conditional',
        'GET /repos/acme/api/actions/runs per_page=10 conditional',
        'GET /repos/acme/api conditional',
        'GET /repos/acme/api/actions/workflows per_page=100 conditional',
    ]);
});

test('the workflows wait for the open items of the first download, not for the closed ones', async () => {
    const { session, tracking, workflows } = await setup(sampleWorld());
    const open = createPromise();
    session.github.holdIf = request => (request.operation === 'RepositoryIssues' ? open.promise : null);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(actionsRequests(session.github.requests)).toEqual([]);

    session.github.holdIf = request => (isClosedPage(request) ? createPromise().promise : null);
    open.resolve();
    await session.clock.advance(0);
    expect(workflows.getState('acme/web').status).toBe('read');
    expect(workflows.getState('acme/api').status).toBe('read');
});

test('a screen asking for the workflows does not wait for the open items', async () => {
    const { session, tracking, workflows, sync } = await setup(sampleWorld());
    session.github.holdIf = request => (request.operation === 'RepositoryIssues' ? createPromise().promise : null);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(0);
    expect(actionsRequests(session.github.requests)).toEqual([]);

    void sync.pollNow('workflows');
    await session.clock.advance(0);
    expect(workflows.getState('acme/web').status).toBe('read');
});

test('a first download that keeps failing does not keep the workflows from being read', async () => {
    const world = sampleWorld();
    const { session, tracking, workflows } = await setup(world);
    world.failing.add('RepositoryIssues null');
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(workflows.getState('acme/web').status).toBe('read');
});

test('a reload during the closed items of the first download reads the workflows at once', async () => {
    const world = sampleWorld();
    const login = uniqueLogin();
    const first = await setup(world, { login });
    first.session.github.holdIf = request => (isClosedPage(request) ? createPromise().promise : null);
    first.tracking.choose(TRACK_BOTH);
    await first.session.clock.advance(0);

    const second = await setup(world, {
        login,
        persistence: first.persistence,
        localStorage: first.session.localStorage,
        holdIf: request => (isClosedPage(request) ? createPromise().promise : null),
    });
    await second.session.clock.advance(0);
    expect(actionsRequests(second.session.github.requests)).not.toEqual([]);
});

test('an untracked repository is not polled, and its workflows go — here and in the kept copy', async () => {
    const world = sampleWorld();
    const login = uniqueLogin();
    const first = await setup(world, { login });
    first.tracking.choose(TRACK_BOTH);
    await first.session.clock.advance(0);
    expect(first.workflows.get('acme/web')).toBeDefined();

    first.tracking.untrack({ kind: 'repository', nameWithOwner: 'acme/web' });
    await first.session.clock.advance(0);
    expect(first.workflows.get('acme/web')).toBeUndefined();
    expect(first.workflows.repositories.map(entry => entry.nameWithOwner)).toEqual(['acme/api']);
    expect(first.workflows.totals.brokenCount).toBe(0);

    first.session.github.requests.length = 0;
    await first.session.clock.advance(WORKFLOWS_INTERVAL);
    expect(actionsRequests(first.session.github.requests)).toEqual([
        'GET /repos/acme/api/actions/runs per_page=10 conditional',
        'GET /repos/acme/api conditional',
        'GET /repos/acme/api/actions/workflows per_page=100 conditional',
    ]);

    // Reloaded: the kept copy holds the tracked repository's workflows only, and its first poll is free.
    const second = await setup(world, {
        login,
        persistence: first.persistence,
        localStorage: first.session.localStorage,
    });
    expect(second.workflows.get('acme/web')).toBeUndefined();
    expect(second.workflows.getState('acme/api').status).toBe('read');
    expect(actionsRequests(second.session.github.requests)).toEqual([
        'GET /repos/acme/api/actions/runs per_page=10 conditional',
        'GET /repos/acme/api conditional',
        'GET /repos/acme/api/actions/workflows per_page=100 conditional',
    ]);
});

test('an answer on its way when the session ends, or its repository is untracked, is dropped: nothing written, nothing more asked', async () => {
    const world = sampleWorld();
    const { session, tracking, workflows, workflowSync, context } = await setupWithoutEngine(world);
    tracking.choose(TRACK_BOTH);

    // The session ends while the first repository's runs are on their way.
    const held = createPromise();
    session.github.holdIf = request => (request.operation === 'GET /repos/acme/web/actions/runs' ? held.promise : null);
    const ended = workflowSync.poll(context.ending(), () => new Set());
    await session.clock.advance(0);
    context.end();
    held.resolve();
    await ended;
    await session.clock.advance(0);
    expect(workflows.get('acme/web')).toBeUndefined();
    expect(actionsRequests(session.github.requests)).toEqual(['GET /repos/acme/web/actions/runs per_page=10']);

    // The session ends while GitHub's refusal is on its way: it says nothing of the repository, for whoever is next.
    world.actions.repository('acme/web').refusal = 403;
    const refusal = createPromise();
    session.github.holdIf = request =>
        request.operation === 'GET /repos/acme/web/actions/runs' ? refusal.promise : null;
    const refused = workflowSync.poll(context.ending(), () => new Set());
    await session.clock.advance(0);
    context.end();
    refusal.resolve();
    await refused;
    expect(workflows.get('acme/web')).toBeUndefined();
    world.actions.repository('acme/web').refusal = null;

    // Untracked while Deploy's runs are on their way: nothing of it is kept or asked, the other repository is read.
    const runs = createPromise();
    session.github.holdIf = request =>
        request.operation === `GET /repos/acme/web/actions/workflows/${DEPLOY}/runs` ? runs.promise : null;
    const untracked = workflowSync.poll(context.ending(), () => new Set());
    await session.clock.advance(0);
    session.github.requests.length = 0;
    tracking.untrack({ kind: 'repository', nameWithOwner: 'acme/web' });
    runs.resolve();
    await untracked;
    await session.clock.advance(0);
    expect(workflows.get('acme/web')).toBeUndefined();
    expect(workflows.getState('acme/api').status).toBe('read');
    expect(actionsRequests(session.github.requests).filter(request => request.includes('acme/web'))).toEqual([]);

    // Untracked while an older page of runs is on its way: the page after it is not asked for.
    const api = world.actions.repository('acme/api');
    api.workflows.push({ id: RELEASE, name: 'Release', state: 'active' });
    for (let id = 300; id < 330; id++) {
        api.runs.push(run(id, RELEASE, 'skipped', `2026-10-29T${String(id - 300).padStart(2, '0')}:00:00Z`));
    }

    const older = createPromise();
    session.github.holdIf = request =>
        request.operation === `GET /repos/acme/api/actions/workflows/${RELEASE}/runs` && request.variables.page === '2'
            ? older.promise
            : null;
    const paging = workflowSync.poll(context.ending(), () => new Set());
    await session.clock.advance(0);
    session.github.requests.length = 0;
    tracking.untrack({ kind: 'repository', nameWithOwner: 'acme/api' });
    older.resolve();
    await paging;
    expect(actionsRequests(session.github.requests)).toEqual([]);
});

/** The world of these tests: acme/web with a broken Deploy, a passing CI and a retired workflow; acme/api with none. */
/** A page of the closed items of the first download. */
function isClosedPage(request: TestGraphQLRequest) {
    return Array.isArray(request.variables.states) && request.variables.states.includes('CLOSED');
}

function sampleWorld(): TrackingWorld {
    const world = createTrackingWorld();
    const web = world.actions.repository('acme/web');
    web.workflows = [
        { id: DEPLOY, name: 'Deploy', state: 'active' },
        { id: CI, name: 'CI', state: 'active' },
        { id: RETIRED, name: 'Retired', state: 'disabled_manually' },
    ];
    web.runs = [
        run(1, DEPLOY, 'success', '2026-10-30T09:00:00Z'),
        run(2, DEPLOY, 'failure', '2026-10-30T10:00:00Z'),
        run(3, CI, 'success', '2026-10-30T10:30:00Z'),
        run(4, CI, 'failure', '2026-10-30T11:00:00Z', { headBranch: 'feature', event: 'pull_request' }),
        run(5, RETIRED, 'failure', '2026-10-30T08:00:00Z'),
    ];
    world.actions.repository('acme/api');
    return world;
}

function run(
    id: number,
    workflowId: number,
    conclusion: string | null,
    createdAt: string,
    overrides: Partial<ActionsWorldRun> = {},
): ActionsWorldRun {
    return {
        id,
        workflowId,
        headBranch: 'main',
        event: 'push',
        status: conclusion === null ? 'in_progress' : 'completed',
        conclusion,
        createdAt,
        ...overrides,
    };
}

interface SetupOptions {
    readonly login?: string;
    readonly persistence?: IndexedDbPersistence;
    /** The `localStorage` of an earlier session, to reload it. */
    readonly localStorage?: Map<string, string>;
    /** The browser whose tab this is. */
    readonly tabs?: TestTabs;
    /** What happens before the kept copy is read, and so before the sync can start. */
    beforeSync?(sync: SyncEngine): void;
    /** Holds back requests from the very first poll on. */
    readonly holdIf?: (request: TestGraphQLRequest) => Promise<void> | null;
}

/** Signs a user in against the world, with the sync running, and lets the first poll run. */
async function setup(world: TrackingWorld, options: SetupOptions = {}) {
    const session = createTestSession({
        login: options.login ?? uniqueLogin(),
        answer: request => world.answer(request),
        answerRest: request => world.answerRest(request),
        localStorage: options.localStorage,
        tabs: options.tabs,
    });
    session.github.holdIf = options.holdIf ?? null;
    const persistence = setIndexedDbPersistence(session.container, options.persistence);

    const items = session.container.resolve(ItemStore);
    const tracking = session.container.resolve(TrackingStore);
    const workflows = session.container.resolve(WorkflowStore);
    const sync = session.container.resolve(SyncEngine);
    options.beforeSync?.(sync);
    await items.ready();
    await workflows.ready();
    await session.clock.advance(0);

    return { session, persistence, items, tracking, workflows, sync };
}

/** Signs a user in against the world without the sync engine: the test polls through a context it controls. */
async function setupWithoutEngine(world: TrackingWorld) {
    const session = createTestSession({
        login: uniqueLogin(),
        answer: request => world.answer(request),
        answerRest: request => world.answerRest(request),
    });
    setIndexedDbPersistence(session.container);

    const items = session.container.resolve(ItemStore);
    const tracking = session.container.resolve(TrackingStore);
    const workflows = session.container.resolve(WorkflowStore);
    const workflowSync = session.container.resolve(WorkflowSync);
    const account = session.container.resolve(AccountSession).current;
    if (!account) {
        throw new Error('Not signed in');
    }

    const rest = session.container.resolve(GitHubRestFactory)(() => account.token);
    await items.ready();
    await workflows.ready();

    let current = true;
    const context = {
        /** A context current until {@link end}. */
        ending(): TrackingSyncContext {
            current = true;
            return { account, rest, isCurrent: () => current, checkAllowance: () => {} };
        },
        end() {
            current = false;
        },
    };

    return { session, tracking, workflows, workflowSync, context };
}

/** `count` runs of Release a pull request started on the day, half an hour apart at most, as a break in polling leaves them. */
function pushPullRequestRuns(runs: ActionsWorldRun[], firstId: number, count: number, day: string) {
    for (let index = 0; index < count; index++) {
        const hour = String(Math.floor(index / 2)).padStart(2, '0');
        const createdAt = `${day}T${hour}:${index % 2 === 0 ? '00' : '30'}:00Z`;
        runs.push(
            run(firstId + index, RELEASE, 'success', createdAt, { headBranch: 'feature', event: 'pull_request' }),
        );
    }
}

/** The requests of Release's runs on any ref. */
function releaseAnyRefRequests(requests: readonly TestGraphQLRequest[]) {
    return actionsRequests(requests).filter(
        request => request.includes(`/workflows/${RELEASE}/runs`) && !request.includes('branch='),
    );
}

function storedOf(workflows: WorkflowStore, nameWithOwner: string) {
    const stored = workflows.get(nameWithOwner);
    if (!stored) {
        throw new Error(`No workflows of ${nameWithOwner} kept`);
    }

    return stored;
}

function stateOf(workflows: WorkflowStore, nameWithOwner: string) {
    return workflows.getState(nameWithOwner).workflows.map(entry => [entry.workflow.name, entry.state]);
}

/** The requests of Actions, of repositories and of their tags, as `<operation> [branch=…] [per_page=…] [page=…] [conditional]`. */
function actionsRequests(requests: readonly TestGraphQLRequest[]) {
    const read: string[] = [];
    for (const { operation, variables } of requests) {
        if (!/^GET \/repos\/[^/]+\/[^/]+(\/actions\/.*|\/git\/matching-refs\/tags)?$/.test(operation)) {
            continue;
        }

        const query = ['branch', 'per_page', 'page']
            .filter(name => typeof variables[name] === 'string')
            .map(name => `${name}=${String(variables[name])}`);
        const conditional = variables.ifNoneMatch === null ? [] : ['conditional'];
        read.push([operation, ...query, ...conditional].join(' '));
    }

    return read;
}

function uniqueLogin() {
    return `user-${crypto.randomUUID()}`;
}
