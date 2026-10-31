import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { getProjectConditional } from './getProjectConditional.js';

test.each([
    ['org', 'https://api.github.com/orgs/AgentScript-AI/projectsV2/3'],
    ['user', 'https://api.github.com/users/AgentScript-AI/projectsV2/3'],
] as const)('asks a project owned by a %s at its path, with the held ETag', async (ownerKind, path) => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering(new Response(null, { status: 304, headers: { etag: '"abc"' } }), requests);

    const result = await getProjectConditional(rest, { ownerKind, owner: 'AgentScript-AI', number: 3, etag: '"abc"' });

    expect(result).toEqual({ status: 304 });
    const [input, init] = requests[0] ?? [];
    expect(input).toBe(path);
    expect(new Headers(init?.headers).get('If-None-Match')).toBe('"abc"');
});

test('returns the new ETag, the node id and the update time once the project changed', async () => {
    const rest = restAnswering(
        Response.json(
            {
                id: 12525673,
                node_id: 'PVT_kwDOC4DARs4AvyBp',
                number: 3,
                title: 'AgentScript development',
                updated_at: '2025-03-04T13:42:43Z',
            },
            { headers: { etag: '"def"' } },
        ),
    );

    expect(await getProjectConditional(rest, { ownerKind: 'org', owner: 'AgentScript-AI', number: 3 })).toEqual({
        status: 200,
        etag: '"def"',
        nodeId: 'PVT_kwDOC4DARs4AvyBp',
        updatedAt: '2025-03-04T13:42:43Z',
    });
});

test.each([
    ['a project that is gone', Response.json({ message: 'Not Found' }, { status: 404 })],
    ['an answer that is not a project', Response.json({ id: 1 })],
])('throws on %s', async (_, response) => {
    const rest = restAnswering(response);

    await expect(getProjectConditional(rest, { ownerKind: 'user', owner: 'kedrzu', number: 1 })).rejects.toBeInstanceOf(
        GitHubApiError,
    );
});

function restAnswering(response: Response, requests: Parameters<Fetch>[] = []) {
    const fetch: Fetch = (...request) => {
        requests.push(request);
        return Promise.resolve(response);
    };

    return createGitHubRestRequester({ getToken: () => 'gho_token', fetch });
}
