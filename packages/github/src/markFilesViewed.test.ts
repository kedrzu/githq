import type { Fetch } from '@nzyme/types/Fetch.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { expect, test } from 'bun:test';

import { createGitHubRequester } from './createGitHubRequester.js';
import { markFilesViewed } from './markFilesViewed.js';

test('marks and unmarks go in one mutation, the paths only as variables, whatever they hold', async () => {
    const path = 'src/"quoted" $p1 \\ {}\n.ts';
    const github = answering({ data: { m0: { clientMutationId: null }, m1: { clientMutationId: null } } });

    await markFilesViewed({
        requester: github.requester,
        pullRequestId: 'PR_1',
        marks: [
            { path, viewed: true },
            { path: 'b.ts', viewed: false },
        ],
    });

    expect(github.bodies).toHaveLength(1);
    const [sent] = github.bodies;
    expect(sent?.variables).toEqual({ pullRequestId: 'PR_1', p0: path, p1: 'b.ts' });
    expect(sent?.query).toMatch(/^mutation MarkFilesViewed\(/);
    expect(sent?.query).toContain('m0: markFileAsViewed(input: { pullRequestId: $pullRequestId, path: $p0 })');
    expect(sent?.query).toContain('m1: unmarkFileAsViewed(input: { pullRequestId: $pullRequestId, path: $p1 })');
    expect(sent?.query).not.toContain('quoted');
});

function answering(payload: unknown) {
    const bodies: { query: unknown; variables: unknown }[] = [];
    const fetch: Fetch = (_, init) => {
        const body: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
        if (isPlainObject(body)) {
            bodies.push({ query: body.query, variables: body.variables });
        }

        return Promise.resolve(Response.json(payload));
    };

    return { bodies, requester: createGitHubRequester({ getToken: () => 'token', fetch }) };
}
