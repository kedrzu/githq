/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { createActionsWorld } from '@/testing/createActionsWorld.js';
import type { ActionsWorld } from '@/testing/createActionsWorld.js';
import type { TestGraphQLRequest } from '@/testing/createTestSession.js';
import { createTestSession } from '@/testing/createTestSession.js';

import { WorkflowRunHistory } from './WorkflowRunHistory.js';
import type { WorkflowRunHistoryQuery } from './WorkflowRunHistory.js';

const DEPLOY = 1;
const ANY_REF: WorkflowRunHistoryQuery = { nameWithOwner: 'acme/web', workflowId: DEPLOY, ref: null };

test('reads a workflow’s runs on any ref a page of 30 at a time, the first once, the next on asking, until none is left', async () => {
    const world = worldWithRuns(45);
    const { session, history } = setup(world);

    history.ensure(ANY_REF);
    expect(history.get(ANY_REF)).toMatchObject({ runs: [], status: 'reading', complete: false });
    await session.clock.advance(0);
    expect(history.get(ANY_REF)).toMatchObject({ status: 'idle', complete: false });
    expect(history.get(ANY_REF).runs.map(entry => entry.id)).toEqual(range(45, 16));

    // Read already: asked again as the workflow unfolds again, nothing is read.
    history.ensure(ANY_REF);
    history.readMore(ANY_REF);
    history.readMore(ANY_REF);
    await session.clock.advance(0);
    expect(history.get(ANY_REF).runs.map(entry => entry.id)).toEqual(range(45, 1));
    expect(history.get(ANY_REF)).toMatchObject({ status: 'idle', complete: true });

    history.readMore(ANY_REF);
    await session.clock.advance(0);
    expect(runRequests(session.github.requests)).toEqual([
        `GET /repos/acme/web/actions/workflows/${DEPLOY}/runs per_page=30`,
        `GET /repos/acme/web/actions/workflows/${DEPLOY}/runs per_page=30 page=2`,
    ]);
});

test('a ref is asked of GitHub by name, and read apart from every ref’s runs', async () => {
    const world = worldWithRuns(3);
    world.repository('acme/web').runs.push({ ...run(4), headBranch: 'v1.0' });
    const { session, history } = setup(world);
    const onTag = { ...ANY_REF, ref: 'v1.0' };

    history.ensure(onTag);
    await session.clock.advance(0);

    expect(history.get(onTag)).toMatchObject({ status: 'idle', complete: true });
    expect(history.get(onTag).runs.map(entry => entry.id)).toEqual([4]);
    expect(history.get(ANY_REF).runs).toEqual([]);
    expect(runRequests(session.github.requests)).toEqual([
        `GET /repos/acme/web/actions/workflows/${DEPLOY}/runs branch=v1.0 per_page=30`,
    ]);
});

test('a failed read says so and asking again asks the same page; another user signing in forgets what was read', async () => {
    const world = worldWithRuns(3);
    world.repository('acme/web').refusal = 500;
    const { session, history } = setup(world);

    history.ensure(ANY_REF);
    await session.clock.advance(0);
    expect(history.get(ANY_REF)).toMatchObject({ runs: [], status: 'failed', complete: false });
    // A failed read is not asked again by itself.
    history.ensure(ANY_REF);
    expect(history.get(ANY_REF).status).toBe('failed');

    world.repository('acme/web').refusal = null;
    history.readMore(ANY_REF);
    await session.clock.advance(0);
    expect(history.get(ANY_REF)).toMatchObject({ status: 'idle', complete: true });
    expect(history.get(ANY_REF).runs).toHaveLength(3);

    session.signInFromAnotherTab('someone-else');
    expect(history.get(ANY_REF)).toMatchObject({ runs: [], status: 'idle', complete: false });
});

function setup(world: ActionsWorld) {
    const session = createTestSession({
        login: `user-${crypto.randomUUID()}`,
        answer: () => undefined,
        answerRest: request => world.answerRest(request),
    });
    return { session, history: session.container.resolve(WorkflowRunHistory) };
}

/** A world where `acme/web`'s Deploy ran `count` times on `main`, run `n` an hour after run `n - 1`. */
function worldWithRuns(count: number) {
    const world = createActionsWorld();
    const repository = world.repository('acme/web');
    repository.workflows.push({ id: DEPLOY, name: 'Deploy', state: 'active' });
    for (const id of range(1, count)) {
        repository.runs.push(run(id));
    }

    return world;
}

function run(id: number) {
    return {
        id,
        workflowId: DEPLOY,
        headBranch: 'main',
        event: 'push',
        status: 'completed',
        conclusion: 'success',
        createdAt: new Date(Date.UTC(2026, 9, 1) + id * 3_600_000).toISOString(),
    };
}

/** The numbers from `from` to `to`, either way. */
function range(from: number, to: number) {
    const step = from <= to ? 1 : -1;
    return Array.from({ length: Math.abs(to - from) + 1 }, (_, index) => from + index * step);
}

/** The requests of a workflow's runs, as `<operation> [branch=…] [per_page=…] [page=…]`. */
function runRequests(requests: readonly TestGraphQLRequest[]) {
    return requests
        .filter(({ operation }) => /\/actions\/workflows\/\d+\/runs$/.test(operation))
        .map(({ operation, variables }) =>
            [
                operation,
                ...['branch', 'per_page', 'page']
                    .filter(name => typeof variables[name] === 'string')
                    .map(name => `${name}=${String(variables[name])}`),
            ].join(' '),
        );
}
