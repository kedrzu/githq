/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { GitHubWorkflowFileParse } from '@githq/github/workflows/parseWorkflowFile.js';

import { createActionsWorld } from '@/testing/createActionsWorld.js';
import type { ActionsWorld } from '@/testing/createActionsWorld.js';
import type { TestGraphQLRequest } from '@/testing/createTestSession.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { uniqueLogin } from '@/testing/uniqueLogin.js';

import { WorkflowFileStore } from './WorkflowFileStore.js';
import type { WorkflowFileTarget } from './WorkflowFileStore.js';

const PATH = '.github/workflows/deploy.yml';
const DEPLOY: WorkflowFileTarget = { nameWithOwner: 'acme/web', path: PATH, ref: 'main' };
const FILE = `on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      target:
        type: choice
        options: [staging, production]
`;

test('nothing is read until asked; then the file at the ref is read and parsed, and kept', async () => {
    const world = createActionsWorld();
    world.repository('acme/web').files.set(PATH, FILE);
    const { session, files } = setup(world);
    await session.clock.advance(0);
    expect(fileRequests(session.github.requests)).toEqual([]);
    expect(files.get(DEPLOY)).toEqual({ parse: null, status: 'idle' });

    files.read(DEPLOY);
    expect(files.get(DEPLOY)).toEqual({ parse: null, status: 'reading' });
    await readOut(files);

    const expected: GitHubWorkflowFileParse = {
        kind: 'parsed',
        file: {
            triggers: [{ event: 'push', branches: ['main'] }, { event: 'workflow_dispatch' }],
            dispatch: {
                inputs: [{ name: 'target', type: 'choice', required: false, options: ['staging', 'production'] }],
            },
            callOnly: false,
        },
    };
    expect(files.get(DEPLOY)).toEqual({ parse: expected, status: 'idle' });
    expect(fileRequests(session.github.requests)).toEqual([`GET /repos/acme/web/contents/${PATH} ref=main`]);
});

test('reading again is conditional: an unchanged file keeps its parse, a changed one is parsed anew', async () => {
    const world = createActionsWorld();
    world.repository('acme/web').files.set(PATH, FILE);
    const { session, files } = setup(world);
    files.read(DEPLOY);
    await readOut(files);
    const parsed = files.get(DEPLOY).parse;

    session.github.requests.length = 0;
    files.read(DEPLOY);
    await readOut(files);
    expect(files.get(DEPLOY)).toEqual({ parse: parsed, status: 'idle' });
    expect(session.github.requests.map(request => typeof request.variables.ifNoneMatch)).toEqual(['string']);

    world.repository('acme/web').files.set(PATH, 'on: [workflow_call]\n');
    files.read(DEPLOY);
    await readOut(files);
    expect(files.get(DEPLOY).parse).toEqual({
        kind: 'parsed',
        file: { triggers: [{ event: 'workflow_call' }], dispatch: null, callOnly: true },
    });
});

test('no file at the ref reads as missing; a refused read says so and keeps what was read', async () => {
    const world = createActionsWorld();
    const { session, files } = setup(world);
    files.read(DEPLOY);
    await readOut(files);
    expect(files.get(DEPLOY)).toEqual({ parse: { kind: 'missing' }, status: 'idle' });

    world.repository('acme/web').refusal = 500;
    files.read(DEPLOY);
    await readOut(files);
    expect(files.get(DEPLOY)).toEqual({ parse: { kind: 'missing' }, status: 'failed' });

    session.signInFromAnotherTab('someone-else');
    expect(files.get(DEPLOY)).toEqual({ parse: null, status: 'idle' });
});

/** Until the read is answered: the YAML parser loads on the first parse, past any fake clock. */
async function readOut(files: WorkflowFileStore) {
    for (let attempt = 0; attempt < 100 && files.get(DEPLOY).status === 'reading'; attempt++) {
        await new Promise(resolve => {
            setTimeout(resolve, 5);
        });
    }
}

function setup(world: ActionsWorld) {
    const session = createTestSession({
        login: uniqueLogin(),
        answer: () => undefined,
        answerRest: request => world.answerRest(request),
    });
    return { session, files: session.container.resolve(WorkflowFileStore) };
}

/** The requests of a file, as `<operation> [ref=…]`. */
function fileRequests(requests: readonly TestGraphQLRequest[]) {
    return requests
        .filter(({ operation }) => operation.includes('/contents/'))
        .map(({ operation, variables }) =>
            typeof variables.ref === 'string' ? `${operation} ref=${variables.ref}` : operation,
        );
}
