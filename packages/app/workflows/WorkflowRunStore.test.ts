/// <reference types="bun" />
// IndexedDB for bun; every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';
import { computed } from 'vue';

import { createPromise } from '@nzyme/utils/createPromise.js';

import { AuthStore } from '@/auth/AuthStore.js';
import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { createActionsWorld } from '@/testing/createActionsWorld.js';
import type { ActionsWorld } from '@/testing/createActionsWorld.js';
import { createTestSession } from '@/testing/createTestSession.js';
import type { TestGraphQLRequest, TestRestAnswer } from '@/testing/createTestSession.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { ReloadHolds } from '@/sync/ReloadHolds.js';
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

test('W4j: a re-run shows at once: the run and its failed jobs running, the attempt moved on, one request whatever is pressed', async () => {
    const world = worldWithRun();
    const context = setup(world);
    const { session, store } = context;
    await read(context);
    const passed = { ...job(71), conclusion: 'success' };
    world.repository(REPO).jobs.set(RUN, [job(JOB), passed]);
    store.refresh(REPO, RUN);
    await session.clock.advance(0);
    const answer = createPromise();
    session.github.hold = answer.promise;

    store.rerun(REPO, RUN);
    store.rerun(REPO, RUN);

    expect(store.getRun(REPO, RUN).run).toMatchObject({ status: 'in_progress', conclusion: null });
    expect(store.getJobs(REPO, RUN).jobs).toMatchObject([
        { id: JOB, status: 'in_progress', conclusion: null, completedAt: null },
        { id: 71, status: 'completed', conclusion: 'success' },
    ]);

    answer.resolve();
    await session.clock.advance(0);
    expect(rerunRequests(session.github.requests)).toHaveLength(1);
});

test('W4j: with GitHub’s reads still saying it failed the run stays running, then their word stands', async () => {
    const context = setup(worldWithRun());
    const { session, store } = context;
    await read(context);

    store.rerun(REPO, RUN);
    await session.clock.advance(0);
    expect(store.getRun(REPO, RUN).run?.status).toBe('in_progress');

    await session.clock.advance(2 * 60_000);
    expect(store.getRun(REPO, RUN).run).toMatchObject({ status: 'completed', conclusion: 'failure' });
});

test('W4j: the failed job’s log is read again once it finishes under the same id', async () => {
    const world = worldWithRun();
    const context = setup(world);
    const { session, store } = context;
    await read(context);
    store.getLog({ nameWithOwner: REPO, jobId: JOB, steps: [] });
    await session.clock.advance(0);
    expect(logRequests(session.github.requests)).toHaveLength(1);

    store.rerun(REPO, RUN);
    await session.clock.advance(0);
    store.getLog({ nameWithOwner: REPO, jobId: JOB, steps: [] });
    await session.clock.advance(0);

    expect(logRequests(session.github.requests)).toHaveLength(2);
});

test('W4l: a refusal takes it all back, shows once until dismissed, and offers the re-run again', async () => {
    const context = setup(worldWithRun(), () => ({
        status: 403,
        body: { message: 'Unable to retry this workflow run because it was created over a month ago' },
    }));
    const { session, store } = context;
    await read(context);

    store.rerun(REPO, RUN);
    await session.clock.advance(0);

    expect(store.getRun(REPO, RUN).run).toMatchObject({ status: 'completed', conclusion: 'failure' });
    expect(store.getJobs(REPO, RUN).jobs).toMatchObject([{ id: JOB, status: 'completed', conclusion: 'failure' }]);
    expect(store.rerunFailure).toMatchObject({ runId: RUN, reason: { kind: 'tooOld' }, toast: true });

    store.setRerunToast(false);
    expect(store.rerunFailure).toMatchObject({ toast: false });
    store.dismissRerunFailure();
    expect(store.rerunFailure).toBeNull();

    store.rerun(REPO, RUN);
    await session.clock.advance(0);
    expect(rerunRequests(session.github.requests)).toHaveLength(2);
});

test('W4l: “already running” follows the run GitHub says is going', async () => {
    const world = worldWithRun();
    const context = setup(world, () => {
        const repository = world.repository(REPO);
        repository.runs = repository.runs.map(run => ({ ...run, status: 'in_progress', conclusion: null }));
        return { status: 403, body: { message: 'This workflow is already running' } };
    });
    const { session, store } = context;
    await read(context);

    store.rerun(REPO, RUN);
    await session.clock.advance(0);

    expect(store.rerunFailure?.reason.kind).toBe('alreadyRunning');
    expect(store.getRun(REPO, RUN).run?.status).toBe('in_progress');
});

test('with the allowance used up nothing is sent and nothing shows as running, and it says so', async () => {
    const context = setup(worldWithRun());
    const { session, store } = context;
    await read(context);
    const until = session.clock.now() + 60_000;
    session.container.resolve(GitHubRateLimitStore).update({
        resource: 'core',
        limit: 5000,
        remaining: 0,
        resetAt: new Date(until),
    });

    store.rerun(REPO, RUN);
    await session.clock.advance(0);

    expect(rerunRequests(session.github.requests)).toEqual([]);
    expect(store.getRun(REPO, RUN).run?.status).toBe('completed');
    expect(store.rerunFailure?.reason).toEqual({ kind: 'allowance', until });
});

test('nothing failed, or nothing known, sends nothing', async () => {
    const world = worldWithRun();
    world.repository(REPO).jobs.set(RUN, [{ ...job(JOB), conclusion: 'success' }]);
    const context = setup(world);
    const { session, store } = context;

    store.rerun(REPO, RUN);
    await read(context);
    store.rerun(REPO, RUN);
    await session.clock.advance(0);

    expect(rerunRequests(session.github.requests)).toEqual([]);
});

test('the tab does not reload while a re-run’s answer is due or its failure not dismissed', async () => {
    const context = setup(worldWithRun(), () => ({ status: 502, body: { message: 'Bad gateway' } }));
    const { session, store } = context;
    await read(context);
    const holds = session.container.resolve(ReloadHolds);
    expect(holds.held).toBe(false);

    store.rerun(REPO, RUN);
    expect(holds.held).toBe(true);
    await session.clock.advance(0);
    expect(store.rerunFailure?.reason).toEqual({ kind: 'serverError', status: 502 });
    expect(holds.held).toBe(true);

    store.dismissRerunFailure();
    expect(holds.held).toBe(false);
});

test('an answer for a session that ended changes nothing and throws nothing', async () => {
    const context = setup(worldWithRun(), () => ({
        status: 403,
        body: { message: 'This workflow is already running' },
    }));
    const { session, store } = context;
    await read(context);
    const answer = createPromise();
    session.github.hold = answer.promise;

    store.rerun(REPO, RUN);
    session.container.resolve(AuthStore).signOut();
    answer.resolve();
    await session.clock.advance(0);

    expect(store.rerunFailure).toBeNull();
});

/** Reads run 7 and its jobs, so a re-run has something to re-run. */
async function read({ session, store }: ReturnType<typeof setup>) {
    store.getRun(REPO, RUN);
    store.getJobs(REPO, RUN);
    await session.clock.advance(0);
}

function rerunRequests(requests: readonly TestGraphQLRequest[]) {
    return requests.filter(({ operation }) => operation.endsWith('/rerun-failed-jobs'));
}

function setup(world: ActionsWorld, rerunAnswer: () => TestRestAnswer = () => ({ status: 201, body: {} })) {
    const session = createTestSession({
        login: `user-${crypto.randomUUID()}`,
        answer: () => undefined,
        answerRest: request =>
            request.operation.endsWith('/rerun-failed-jobs') ? rerunAnswer() : world.answerRest(request),
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
