/// <reference types="bun" />
// IndexedDB for bun; every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import { createActionsWorld } from '@/testing/createActionsWorld.js';
import type { ActionsWorld } from '@/testing/createActionsWorld.js';
import { createTestSession } from '@/testing/createTestSession.js';
import type { TestRestAnswer } from '@/testing/createTestSession.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { uniqueLogin } from '@/testing/uniqueLogin.js';

import { WorkflowDispatch } from './WorkflowDispatch.js';
import type { WorkflowDispatchParams } from './WorkflowDispatch.js';
import { WorkflowRunHistory } from './WorkflowRunHistory.js';

const REPO = 'acme/web';
const WORKFLOW = 1;
const NEW_RUN = 4826;
const DISPATCHES = `POST /repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`;
const DEPLOY: WorkflowDispatchParams = {
    nameWithOwner: REPO,
    workflowId: WORKFLOW,
    workflowName: 'Deploy',
    ref: 'release/2.14',
    inputs: { environment: 'production', dry_run: false },
};

test('the chosen ref and only the inputs given are sent; the new run is named and leads the workflow’s runs', async () => {
    const world = worldWithDeploy();
    const tested = setup(world, () => {
        // GitHub queues the run as it answers.
        world.repository(REPO).runs.push(queuedRun());
        return {
            status: 200,
            body: { workflow_run_id: NEW_RUN, html_url: `https://github.com/${REPO}/actions/runs/${NEW_RUN}` },
        };
    });
    const { session, dispatch, history } = tested;
    await openDeploy(tested);

    await dispatch.dispatch(DEPLOY);

    const sent = session.github.requests.filter(({ operation }) => operation === DISPATCHES);
    expect(sent.map(request => request.variables.body)).toEqual([
        { ref: 'release/2.14', inputs: { environment: 'production', dry_run: false }, return_run_details: true },
    ]);
    expect(dispatch.started).toMatchObject({
        workflowName: 'Deploy',
        ref: 'release/2.14',
        runId: NEW_RUN,
        runNumber: NEW_RUN,
    });
    expect(dispatch.failure).toBeNull();
    expect(history.getRuns({ nameWithOwner: REPO, workflowId: WORKFLOW }).runs.map(run => run.id)).toEqual([
        NEW_RUN,
        10,
    ]);
});

test('with no input entered, none are sent', async () => {
    const world = worldWithDeploy();
    const { session, dispatch } = setup(world, () => {
        world.repository(REPO).runs.push(queuedRun());
        return { status: 200, body: { workflow_run_id: NEW_RUN, html_url: 'https://github.com/' } };
    });

    await dispatch.dispatch({ ...DEPLOY, ref: 'main', inputs: {} });

    const sent = session.github.requests.filter(({ operation }) => operation === DISPATCHES);
    expect(sent.map(request => request.variables.body)).toEqual([{ ref: 'main', return_run_details: true }]);
});

test('a refusal says GitHub’s words and starts nothing', async () => {
    const tested = setup(worldWithDeploy(), () => ({
        status: 422,
        body: { message: "Workflow does not have 'workflow_dispatch' trigger" },
    }));
    const { dispatch, history } = tested;
    await openDeploy(tested);

    await dispatch.dispatch(DEPLOY);

    expect(dispatch.started).toBeNull();
    expect(dispatch.failure).toMatchObject({
        workflowName: 'Deploy',
        reason: { kind: 'refused', message: "Workflow does not have 'workflow_dispatch' trigger" },
    });
    expect(history.getRuns({ nameWithOwner: REPO, workflowId: WORKFLOW }).runs.map(run => run.id)).toEqual([10]);
});

function setup(world: ActionsWorld, dispatchAnswer: () => TestRestAnswer) {
    const session = createTestSession({
        login: uniqueLogin(),
        answer: () => undefined,
        answerRest: request => (request.operation === DISPATCHES ? dispatchAnswer() : world.answerRest(request)),
    });
    setIndexedDbPersistence(session.container);
    return {
        session,
        dispatch: session.container.resolve(WorkflowDispatch),
        history: session.container.resolve(WorkflowRunHistory),
    };
}

/** The workflow opened as an item, its first page of runs read. */
async function openDeploy({ session, history }: ReturnType<typeof setup>) {
    history.open({ nameWithOwner: REPO, workflowId: WORKFLOW });
    await session.clock.advance(0);
}

/** `acme/web`'s Deploy, with one run read as its history's first page. */
function worldWithDeploy() {
    const world = createActionsWorld();
    const repository = world.repository(REPO);
    repository.workflows.push({ id: WORKFLOW, name: 'Deploy', state: 'active' });
    repository.runs.push({
        id: 10,
        workflowId: WORKFLOW,
        headBranch: 'main',
        event: 'push',
        status: 'completed',
        conclusion: 'success',
        createdAt: '2026-10-30T12:00:00Z',
    });
    return world;
}

function queuedRun() {
    return {
        id: NEW_RUN,
        workflowId: WORKFLOW,
        headBranch: 'release/2.14',
        event: 'workflow_dispatch',
        status: 'queued',
        conclusion: null,
        createdAt: '2026-10-30T13:00:00Z',
    };
}
