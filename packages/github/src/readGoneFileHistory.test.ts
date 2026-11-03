import type { Fetch } from '@nzyme/types/Fetch.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { expect, test } from 'bun:test';

import { createGitHubRequester } from './createGitHubRequester.js';
import { readGoneFileHistory } from './readGoneFileHistory.js';

const REPOSITORY = { owner: 'acme', name: 'web' };

const deleting = { abbreviatedOid: '9b7e411', file: null, parents: { nodes: [{ file: { oid: 'x' } }] } };
const changing = { abbreviatedOid: '5555555', file: { oid: 'y' }, parents: { nodes: [{ file: { oid: 'x' } }] } };
const adding = { abbreviatedOid: '3f0c2aa', file: { oid: 'x' }, parents: { nodes: [{ file: null }] } };

test('a file added and deleted again names both commits, a missing file answering NOT_FOUND beside the data; one query for all paths, by variables', async () => {
    const { requester, bodies } = answering({
        data: {
            repository: {
                object: { h0: { nodes: [deleting, changing, adding] }, h1: { nodes: [deleting, adding] } },
            },
        },
        errors: [
            {
                type: 'NOT_FOUND',
                message: 'Could not resolve to a tree entry',
                path: ['repository', 'object', 'h0', 'nodes', 0, 'file'],
            },
        ],
    });

    const histories = await readGoneFileHistory({
        requester,
        repository: REPOSITORY,
        head: 'head-1',
        paths: ['a "quoted" path.ts', 'b.ts'],
    });

    expect(histories).toEqual(
        new Map([
            ['a "quoted" path.ts', { added: '3f0c2aa', deleted: '9b7e411' }],
            ['b.ts', { added: '3f0c2aa', deleted: '9b7e411' }],
        ]),
    );
    expect(bodies).toHaveLength(1);
    expect(bodies[0]?.variables).toMatchObject({ head: 'head-1', p0: 'a "quoted" path.ts', p1: 'b.ts' });
    expect(bodies[0]?.query).toMatch(/^query ReviewGoneFileHistory\(/u);
});

test('history that says nothing, a file changed and put back, and an answer GitHub failed on give no reason', async () => {
    const { requester } = answering({
        data: {
            repository: {
                object: {
                    // Commits force-pushed away.
                    h0: { nodes: [] },
                    // The newest commit still has it: it never left, so "added" would be false.
                    h1: { nodes: [changing, changing] },
                    // Deleted, but nothing within reach added it.
                    h2: { nodes: [deleting, changing] },
                    // A `file` of `null` here isn't the file missing.
                    h3: { nodes: [deleting, adding] },
                },
            },
        },
        errors: [{ type: 'FORBIDDEN', message: 'No', path: ['repository', 'object', 'h3', 'nodes', 0, 'file'] }],
    });

    const histories = await readGoneFileHistory({
        requester,
        repository: REPOSITORY,
        head: 'head-1',
        paths: ['a.ts', 'b.ts', 'c.ts', 'd.ts'],
    });

    expect(histories).toEqual(new Map());
});

test('a head GitHub no longer has gives no reasons', async () => {
    const { requester } = answering({
        data: { repository: { object: null } },
        errors: [{ type: 'NOT_FOUND', message: 'No such object', path: ['repository', 'object'] }],
    });

    expect(await readGoneFileHistory({ requester, repository: REPOSITORY, head: 'gone', paths: ['a.ts'] })).toEqual(
        new Map(),
    );
});

interface SentBody {
    readonly query: unknown;
    readonly variables: unknown;
}

function answering(answer: unknown) {
    const bodies: SentBody[] = [];
    const fetch: Fetch = (_, init) => {
        const body: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
        if (isPlainObject(body)) {
            bodies.push({ query: body.query, variables: body.variables });
        }

        return Promise.resolve(Response.json(answer));
    };

    return { bodies, requester: createGitHubRequester({ getToken: () => 'gho_token', fetch }) };
}
