/// <reference types="bun" />
// IndexedDB for bun; every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import { createPromise } from '@nzyme/utils/createPromise.js';

import { AccountSession } from '@/auth/AccountSession.js';
import { GitHubRestFactory } from '@/services/GitHubRestFactory.js';
import type { IndexedDbPersistence } from '@/store/IndexedDbPersistence.js';
import { ItemStore } from '@/store/ItemStore.js';
import { SyncEngine } from '@/sync/SyncEngine.js';
import type { TrackingSyncContext } from '@/sync/TrackingSync.js';
import type { ActionsWorldRun } from '@/testing/createActionsWorld.js';
import type { TestGraphQLRequest } from '@/testing/createTestSession.js';
import { createTestSession, TEST_START } from '@/testing/createTestSession.js';
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

test('the first read: the latest runs, the default branch, the workflows, and each active workflow’s runs on the default branch', async () => {
    const world = sampleWorld();
    const { session, tracking, workflows } = await setup(world);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(0);

    expect(actionsRequests(session.github.requests)).toEqual([
        'GET /repos/acme/web/actions/runs per_page=10',
        'GET /repos/acme/web',
        'GET /repos/acme/web/actions/workflows per_page=100',
        `GET /repos/acme/web/actions/workflows/${DEPLOY}/runs branch=main per_page=10`,
        `GET /repos/acme/web/actions/workflows/${CI}/runs branch=main per_page=10`,
        'GET /repos/acme/api/actions/runs per_page=10',
        'GET /repos/acme/api',
        'GET /repos/acme/api/actions/workflows per_page=100',
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

test('while no run moves a poll costs one free request per repository and changes nothing but the read time; a run that moved is read again alone', async () => {
    const world = sampleWorld();
    const { session, tracking, workflows, sync } = await setup(world);
    tracking.choose(TRACK_BOTH);
    await session.clock.advance(0);
    const before = storedOf(workflows, 'acme/web');

    session.github.requests.length = 0;
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(actionsRequests(session.github.requests)).toEqual([
        'GET /repos/acme/web/actions/runs per_page=10 conditional',
        'GET /repos/acme/api/actions/runs per_page=10 conditional',
    ]);
    const after = storedOf(workflows, 'acme/web');
    expect(after.readAt).toBe(TEST_START + WORKFLOWS_INTERVAL);
    expect({ ...after, readAt: before.readAt }).toEqual(before);
    expect(sync.getWorkflowsFreshness().kind).toBe('fresh');

    // Deploy runs again on main and passes: only its runs are read again; the default branch and the list are not.
    world.actions.repository('acme/web').runs.push(run(20, DEPLOY, 'success', '2026-10-30T13:01:00Z'));
    session.github.requests.length = 0;
    await session.clock.advance(WORKFLOWS_INTERVAL);
    expect(actionsRequests(session.github.requests)).toEqual([
        'GET /repos/acme/web/actions/runs per_page=10 conditional',
        'GET /repos/acme/web conditional',
        'GET /repos/acme/web/actions/workflows per_page=100 conditional',
        `GET /repos/acme/web/actions/workflows/${DEPLOY}/runs branch=main per_page=10 conditional`,
        'GET /repos/acme/api/actions/runs per_page=10 conditional',
    ]);
    expect(workflows.getState('acme/web').workflows[0]).toMatchObject({ state: 'passing' });
    expect(workflows.totals.brokenCount).toBe(0);
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

test('a repository whose Actions GitHub refuses or turned off is said so without failing the loop, and asked again an hour later', async () => {
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
    expect(actionsRequests(session.github.requests)).toEqual([]);

    // Turned on again: read at the first poll an hour on (the tab hidden meanwhile, so the polls are fewer).
    world.actions.repository('acme/web').refusal = null;
    world.actions.repository('acme/api').refusal = null;
    session.setVisible(false);
    await session.clock.advance(60 * 60_000);
    session.setVisible(true);
    await session.clock.advance(0);
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
    sync.pollWorkflowsNow();
    await session.clock.advance(0);
    expect(actionsRequests(session.github.requests)).toEqual([
        'GET /repos/acme/web/actions/runs per_page=10 conditional',
        'GET /repos/acme/api/actions/runs per_page=10 conditional',
    ]);

    const held = createPromise();
    session.github.holdIf = request => (request.operation === 'GET /repos/acme/web/actions/runs' ? held.promise : null);
    session.github.requests.length = 0;
    sync.pollWorkflowsNow();
    await session.clock.advance(0);
    sync.pollWorkflowsNow();
    sync.pollWorkflowsNow();
    await session.clock.advance(0);
    held.resolve();
    await session.clock.advance(0);
    expect(actionsRequests(session.github.requests)).toEqual([
        'GET /repos/acme/web/actions/runs per_page=10 conditional',
        'GET /repos/acme/api/actions/runs per_page=10 conditional',
    ]);
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
    ]);
});

test('an answer on its way when the session ends, or its repository is untracked, is dropped, never written', async () => {
    const world = sampleWorld();
    const { session, tracking, workflows, workflowSync, context } = await setupWithoutEngine(world);
    tracking.choose(TRACK_BOTH);

    // The session ends while the first repository's runs are on their way.
    const held = createPromise();
    session.github.holdIf = request => (request.operation === 'GET /repos/acme/web/actions/runs' ? held.promise : null);
    const ended = workflowSync.poll(context.ending());
    await session.clock.advance(0);
    context.end();
    held.resolve();
    await ended;
    await session.clock.advance(0);
    expect(workflows.get('acme/web')).toBeUndefined();
    expect(actionsRequests(session.github.requests)).toEqual(['GET /repos/acme/web/actions/runs per_page=10']);

    // Untracked while Deploy's runs are on their way: nothing of it is kept, the other repository is read.
    const runs = createPromise();
    session.github.holdIf = request =>
        request.operation === `GET /repos/acme/web/actions/workflows/${DEPLOY}/runs` ? runs.promise : null;
    const untracked = workflowSync.poll(context.ending());
    await session.clock.advance(0);
    tracking.untrack({ kind: 'repository', nameWithOwner: 'acme/web' });
    runs.resolve();
    await untracked;
    await session.clock.advance(0);
    expect(workflows.get('acme/web')).toBeUndefined();
    expect(workflows.getState('acme/api').status).toBe('read');
});

/** The world of these tests: acme/web with a broken Deploy, a passing CI and a retired workflow; acme/api with none. */
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
}

/** Signs a user in against the world, with the sync running, and lets the first poll run. */
async function setup(world: TrackingWorld, options: SetupOptions = {}) {
    const session = createTestSession({
        login: options.login ?? uniqueLogin(),
        answer: request => world.answer(request),
        answerRest: request => world.answerRest(request),
        localStorage: options.localStorage,
    });
    const persistence = setIndexedDbPersistence(session.container, options.persistence);

    const items = session.container.resolve(ItemStore);
    const tracking = session.container.resolve(TrackingStore);
    const workflows = session.container.resolve(WorkflowStore);
    const sync = session.container.resolve(SyncEngine);
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

/** The requests of Actions and of repositories, as `<operation> [branch=…] [per_page=…] [page=…] [conditional]`. */
function actionsRequests(requests: readonly TestGraphQLRequest[]) {
    const read: string[] = [];
    for (const { operation, variables } of requests) {
        if (!/^GET \/repos\/[^/]+\/[^/]+(\/actions\/.*)?$/.test(operation)) {
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
