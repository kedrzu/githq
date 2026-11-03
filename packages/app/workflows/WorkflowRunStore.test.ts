/// <reference types="bun" />
// IndexedDB for bun; every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';
import { computed } from 'vue';

import { createPromise } from '@nzyme/utils/createPromise.js';

import { createActionsWorld } from '@/testing/createActionsWorld.js';
import type { ActionsWorld } from '@/testing/createActionsWorld.js';
import { createTestSession } from '@/testing/createTestSession.js';
import type { TestGraphQLRequest } from '@/testing/createTestSession.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { WorkflowRunStore } from './WorkflowRunStore.js';
import { WorkflowStore } from './WorkflowStore.js';

const REPO = 'acme/web';
const RUN = 7;
const JOB = 70;
const STEPS = [
    {
        name: 'Tests',
        number: 1,
        status: 'completed',
        conclusion: 'failure',
        startedAt: '2026-11-02T19:00:10Z',
        completedAt: '2026-11-02T19:00:20Z',
    },
];
const LOG =
    '\uFEFF2026-11-02T19:00:10.1234567Z ##[group]Run bun test\n2026-11-02T19:00:11.1234567Z ##[error]exit code 1\n';

test('nothing is read until asked', async () => {
    const { session } = setup(worldWithRun());

    await session.clock.advance(0);

    expect(session.github.requests.filter(({ operation }) => operation.includes('/actions/'))).toEqual([]);
});

test('a run is told as stored at once, then as read', async () => {
    const { session, store } = setup(worldWithRun());
    session.container.resolve(TrackingStore).track({ repository: { nameWithOwner: REPO, id: 'R_web' } });
    session.container.resolve(WorkflowStore).set(storedRun());

    expect(store.getRun(REPO, RUN)).toMatchObject({
        status: 'loading',
        run: { id: RUN, workflowName: 'Stored name', headCommitMessage: null },
    });

    await session.clock.advance(0);

    expect(store.getRun(REPO, RUN)).toMatchObject({
        status: 'ready',
        run: { id: RUN, workflowName: 'Deploy', headCommitMessage: `Commit of run ${RUN}` },
    });
    expect(runRequests(session.github.requests)).toEqual([`GET /repos/${REPO}/actions/runs/${RUN}`]);
});

test('a run GitHub does not have is gone, one it fails on says how, and refreshing asks again', async () => {
    const world = worldWithRun();
    const { session, store } = setup(world);

    store.getRun(REPO, 999);
    await session.clock.advance(0);
    expect(store.getRun(REPO, 999)).toMatchObject({ status: 'gone', run: null });

    world.repository(REPO).refusal = 500;
    store.getRun(REPO, RUN);
    await session.clock.advance(0);
    expect(store.getRun(REPO, RUN)).toMatchObject({ status: 'failed', httpStatus: 500, run: null });

    world.repository(REPO).refusal = null;
    store.refresh(REPO, RUN);
    await session.clock.advance(0);
    expect(store.getRun(REPO, RUN)).toMatchObject({ status: 'ready', run: { id: RUN } });
});

test('asking again says what it said until GitHub answers: the page has nothing to blink', async () => {
    const world = worldWithRun();
    const { session, store } = setup(world);

    store.getRun(REPO, 999);
    store.getJobs(REPO, 999);
    await session.clock.advance(0);
    store.refresh(REPO, 999);
    expect(store.getRun(REPO, 999)).toMatchObject({ status: 'gone', run: null });
    expect(store.getJobs(REPO, 999)).toMatchObject({ status: 'gone', jobs: [] });
    await session.clock.advance(0);

    world.repository(REPO).refusal = 500;
    store.getJobs(REPO, RUN);
    await session.clock.advance(0);
    store.refresh(REPO, RUN);
    expect(store.getJobs(REPO, RUN)).toMatchObject({ status: 'failed', httpStatus: 500 });
    await session.clock.advance(0);
    expect(store.getJobs(REPO, RUN)).toMatchObject({ status: 'failed', httpStatus: 500 });

    world.repository(REPO).refusal = null;
    store.refresh(REPO, RUN);
    expect(store.getJobs(REPO, RUN)).toMatchObject({ status: 'failed', httpStatus: 500 });
    await session.clock.advance(0);
    expect(store.getJobs(REPO, RUN).status).toBe('ready');
});

test('the jobs say when GitHub last answered for them: a 304 counts, a failure does not', async () => {
    const world = worldWithRun();
    const { session, store } = setup(world);

    expect(store.getJobs(REPO, RUN).checkedAt).toBeNull();
    await session.clock.advance(0);
    const first = session.clock.now();
    expect(store.getJobs(REPO, RUN).checkedAt).toBe(first);

    await session.clock.advance(30_000);
    store.refresh(REPO, RUN);
    await session.clock.advance(0);
    const second = session.clock.now();
    expect(second).toBeGreaterThan(first);
    expect(store.getJobs(REPO, RUN).checkedAt).toBe(second);

    world.repository(REPO).refusal = 500;
    await session.clock.advance(30_000);
    store.refresh(REPO, RUN);
    await session.clock.advance(0);
    expect(store.getJobs(REPO, RUN).checkedAt).toBe(second);
});

test('jobs are read once, refreshed conditionally: a 304 keeps them, a change is told, a failure says nothing', async () => {
    const world = worldWithRun();
    const { session, store } = setup(world);

    store.getJobs(REPO, RUN);
    store.getJobs(REPO, RUN);
    expect(store.getJobs(REPO, RUN)).toEqual({ jobs: [], status: 'loading', httpStatus: null, checkedAt: null });
    await session.clock.advance(0);
    expect(store.getJobs(REPO, RUN).status).toBe('ready');
    expect(store.getJobs(REPO, RUN).jobs.map(entry => entry.id)).toEqual([JOB]);
    expect(jobRequests(session.github.requests)).toHaveLength(1);

    store.refresh(REPO, RUN);
    await session.clock.advance(0);
    const [, conditional] = jobRequests(session.github.requests);
    expect(typeof conditional?.variables.ifNoneMatch).toBe('string');
    expect(store.getJobs(REPO, RUN).jobs.map(entry => entry.id)).toEqual([JOB]);

    world.repository(REPO).jobs.set(RUN, [job(JOB), job(71)]);
    store.refresh(REPO, RUN);
    expect(store.getJobs(REPO, RUN).status).toBe('ready');
    await session.clock.advance(0);
    expect(store.getJobs(REPO, RUN).jobs.map(entry => entry.id)).toEqual([JOB, 71]);

    world.repository(REPO).refusal = 500;
    store.refresh(REPO, RUN);
    await session.clock.advance(0);
    expect(store.getJobs(REPO, RUN)).toMatchObject({ status: 'ready', httpStatus: null });
    expect(store.getJobs(REPO, RUN).jobs).toHaveLength(2);
});

test('a log loads, is read once however often asked, and comes parsed', async () => {
    const { session, store } = setup(worldWithRun());

    expect(store.getLog({ nameWithOwner: REPO, jobId: JOB, steps: STEPS })).toEqual({ status: 'loading' });
    store.getLog({ nameWithOwner: REPO, jobId: JOB, steps: STEPS });
    await session.clock.advance(0);

    const state = store.getLog({ nameWithOwner: REPO, jobId: JOB, steps: STEPS });
    if (state.status !== 'ready') {
        throw new Error(`Expected a read log, got ${state.status}`);
    }

    expect(state.log.errors.length).toBeGreaterThan(0);
    expect(state.log.lines.map(({ text, stepNumber }) => ({ text, stepNumber }))).toEqual([
        { text: 'Run bun test', stepNumber: 1 },
        { text: 'exit code 1', stepNumber: 1 },
    ]);
    expect(logRequests(session.github.requests)).toEqual([`GET /repos/${REPO}/actions/jobs/${JOB}/logs`]);
});

test.each([404, 410])('a log answering %d is gone, and no failure', async status => {
    const world = worldWithRun();
    world.repository(REPO).logs.set(JOB, status);
    const { session, store } = setup(world);

    store.getLog({ nameWithOwner: REPO, jobId: JOB, steps: STEPS });
    await session.clock.advance(0);

    expect(store.getLog({ nameWithOwner: REPO, jobId: JOB, steps: STEPS })).toEqual({ status: 'gone' });
});

test('a log failing says with what, and retrying reads it, one read at a time', async () => {
    const world = worldWithRun();
    world.repository(REPO).logs.set(JOB, 502);
    const { session, store } = setup(world);

    store.getLog({ nameWithOwner: REPO, jobId: JOB, steps: STEPS });
    await session.clock.advance(0);
    expect(store.getLog({ nameWithOwner: REPO, jobId: JOB, steps: STEPS })).toEqual({
        status: 'failed',
        httpStatus: 502,
    });

    world.repository(REPO).logs.set(JOB, LOG);
    store.retry({ nameWithOwner: REPO, jobId: JOB, steps: STEPS });
    store.retry({ nameWithOwner: REPO, jobId: JOB, steps: STEPS });
    expect(store.getLog({ nameWithOwner: REPO, jobId: JOB, steps: STEPS })).toEqual({ status: 'loading' });
    await session.clock.advance(0);

    expect(store.getLog({ nameWithOwner: REPO, jobId: JOB, steps: STEPS }).status).toBe('ready');
    expect(logRequests(session.github.requests)).toHaveLength(2);
});

test('of the logs read the 5 last asked stay; one dropped is read anew', async () => {
    const world = worldWithRun();
    for (const id of [1, 2, 3, 4, 5, 6]) {
        world.repository(REPO).logs.set(id, LOG);
    }

    const { session, store } = setup(world);
    for (const id of [1, 2, 3, 4, 5]) {
        store.getLog({ nameWithOwner: REPO, jobId: id, steps: STEPS });
    }

    await session.clock.advance(0);
    store.getLog({ nameWithOwner: REPO, jobId: 1, steps: STEPS });
    store.getLog({ nameWithOwner: REPO, jobId: 6, steps: STEPS });
    await session.clock.advance(0);
    expect(logRequests(session.github.requests)).toHaveLength(6);

    expect(store.getLog({ nameWithOwner: REPO, jobId: 1, steps: STEPS }).status).toBe('ready');
    expect(logRequests(session.github.requests)).toHaveLength(6);

    expect(store.getLog({ nameWithOwner: REPO, jobId: 2, steps: STEPS }).status).toBe('loading');
    await session.clock.advance(0);
    expect(logRequests(session.github.requests)).toHaveLength(7);
});

test('with the core allowance used up nothing is asked, and each read says it was not', async () => {
    const world = worldWithRun();
    const { session, store } = setup(world);
    session.github.coreRemaining = 0;
    store.getJobs(REPO, 999);
    await session.clock.advance(0);
    session.github.requests.length = 0;

    expect(store.getRun(REPO, RUN)).toMatchObject({ status: 'failed', httpStatus: null });
    expect(store.getJobs(REPO, RUN)).toMatchObject({ status: 'failed', httpStatus: null });
    expect(store.getLog({ nameWithOwner: REPO, jobId: JOB, steps: STEPS })).toEqual({
        status: 'failed',
        httpStatus: null,
    });
    store.retry({ nameWithOwner: REPO, jobId: JOB, steps: STEPS });
    store.refresh(REPO, RUN);
    await session.clock.advance(0);

    expect(session.github.requests.filter(({ operation }) => operation.includes('/actions/'))).toEqual([]);
});

test('an answer for an ended session is dropped, and what was read goes with the user', async () => {
    const { session, store } = setup(worldWithRun());
    store.getLog({ nameWithOwner: REPO, jobId: JOB, steps: STEPS });
    await session.clock.advance(0);
    expect(store.getLog({ nameWithOwner: REPO, jobId: JOB, steps: STEPS }).status).toBe('ready');

    // The first user's reads are held past their session's end, the next user's until the end of the test.
    const first = createPromise();
    const second = createPromise();
    let held = first;
    session.github.holdIf = () => held.promise;
    store.getLog({ nameWithOwner: REPO, jobId: 71, steps: STEPS });
    store.getJobs(REPO, RUN);
    store.getRun(REPO, RUN);

    session.signInFromAnotherTab('someone-else');
    held = second;
    expect(store.getLog({ nameWithOwner: REPO, jobId: JOB, steps: STEPS })).toEqual({ status: 'loading' });
    expect(store.getLog({ nameWithOwner: REPO, jobId: 71, steps: STEPS })).toEqual({ status: 'loading' });
    expect(store.getRun(REPO, RUN)).toMatchObject({ status: 'loading', run: null });

    first.resolve();
    await session.clock.advance(0);
    expect(store.getLog({ nameWithOwner: REPO, jobId: 71, steps: STEPS })).toEqual({ status: 'loading' });
    expect(store.getJobs(REPO, RUN).jobs).toEqual([]);
    expect(store.getRun(REPO, RUN)).toMatchObject({ status: 'loading', run: null });

    second.resolve();
    await session.clock.advance(0);
    expect(store.getLog({ nameWithOwner: REPO, jobId: JOB, steps: STEPS }).status).toBe('ready');
});

test('signing out drops the logs, and nothing is read while signed out', async () => {
    const { session, store } = setup(worldWithRun());
    store.getLog({ nameWithOwner: REPO, jobId: JOB, steps: STEPS });
    await session.clock.advance(0);
    expect(store.getLog({ nameWithOwner: REPO, jobId: JOB, steps: STEPS }).status).toBe('ready');

    session.github.requests.length = 0;
    session.signOutFromAnotherTab();

    expect(store.getLog({ nameWithOwner: REPO, jobId: JOB, steps: STEPS })).toEqual({ status: 'loading' });
    expect(store.getJobs(REPO, RUN)).toMatchObject({ status: 'loading', jobs: [] });
    store.retry({ nameWithOwner: REPO, jobId: JOB, steps: STEPS });
    store.refresh(REPO, RUN);
    await session.clock.advance(0);
    expect(session.github.requests.filter(({ operation }) => operation.includes('/actions/'))).toEqual([]);
});

test('`get…` may be called from a `computed`, which follows the read and the sign-out', async () => {
    const { session, store } = setup(worldWithRun());
    const log = computed(() => store.getLog({ nameWithOwner: REPO, jobId: JOB, steps: STEPS }).status);
    const jobs = computed(() => store.getJobs(REPO, RUN).status);

    expect(log.value).toBe('loading');
    expect(jobs.value).toBe('loading');

    await session.clock.advance(0);
    expect(log.value).toBe('ready');
    expect(jobs.value).toBe('ready');

    session.signInFromAnotherTab('someone-else');
    expect(log.value).toBe('loading');
});

function setup(world: ActionsWorld) {
    const session = createTestSession({
        login: `user-${crypto.randomUUID()}`,
        answer: () => undefined,
        answerRest: request => world.answerRest(request),
    });
    setIndexedDbPersistence(session.container);
    return { session, store: session.container.resolve(WorkflowRunStore) };
}

/** A world where `acme/web` has run 7 with job 70, whose log is {@link LOG}. */
function worldWithRun() {
    const world = createActionsWorld();
    const repository = world.repository(REPO);
    repository.workflows.push({ id: 1, name: 'Deploy', state: 'active' });
    repository.runs.push({
        id: RUN,
        workflowId: 1,
        headBranch: 'main',
        event: 'push',
        status: 'completed',
        conclusion: 'failure',
        createdAt: '2026-11-02T19:00:00Z',
    });
    repository.jobs.set(RUN, [job(JOB)]);
    repository.logs.set(JOB, LOG);
    return world;
}

function job(id: number) {
    return { id, name: `Job ${id}`, status: 'completed', conclusion: 'failure', steps: [] };
}

/** What the sync keeps of `acme/web`, with run 7 under a workflow of another name than its own answer's. */
function storedRun() {
    return {
        nameWithOwner: REPO,
        defaultBranch: 'main',
        repositoryEtag: null,
        runsEtag: null,
        workflowsEtag: null,
        tagsEtag: null,
        tags: [],
        unavailable: null,
        workflows: [
            {
                workflow: {
                    id: 1,
                    name: 'Stored name',
                    path: '.github/workflows/deploy.yml',
                    state: 'active',
                    htmlUrl: 'https://github.com/acme/web/actions/workflows/1',
                },
                etags: {},
                runs: [
                    {
                        id: RUN,
                        workflowId: 1,
                        runNumber: 1,
                        headBranch: 'main',
                        event: 'push',
                        status: 'completed',
                        conclusion: 'failure',
                        createdAt: '2026-11-02T19:00:00Z',
                        htmlUrl: 'https://github.com/acme/web/actions/runs/7',
                        headSha: 'abc',
                        displayTitle: 'Run 7',
                        updatedAt: '2026-11-02T19:00:00Z',
                    },
                ],
            },
        ],
    };
}

function runRequests(requests: readonly TestGraphQLRequest[]) {
    return requests.map(({ operation }) => operation).filter(operation => /\/actions\/runs\/\d+$/.test(operation));
}

function jobRequests(requests: readonly TestGraphQLRequest[]) {
    return requests.filter(({ operation }) => operation.endsWith('/jobs'));
}

function logRequests(requests: readonly TestGraphQLRequest[]) {
    return requests.map(({ operation }) => operation).filter(operation => operation.endsWith('/logs'));
}
