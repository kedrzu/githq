import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { listRepositoryRuns } from './listRepositoryRuns.js';
import type { ListRepositoryRunsResult } from './listRepositoryRuns.js';

test('sends the held ETag for a small page and reports 304 while no run moved', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering(new Response(null, { status: 304, headers: { etag: '"abc"' } }), requests);

    const result = await listRepositoryRuns(rest, { nameWithOwner: 'kedrzu/githq', etag: '"abc"' });

    expect(result).toEqual({ status: 304 });
    const [input, init] = requests[0] ?? [];
    expect(input).toBe('https://api.github.com/repos/kedrzu/githq/actions/runs?per_page=10');
    expect(new Headers(init?.headers).get('If-None-Match')).toBe('"abc"');
});

test('returns the new ETag once a run moved', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering(
        Response.json({ total_count: 0, workflow_runs: [] }, { headers: { etag: '"def"' } }),
        requests,
    );

    const result = await listRepositoryRuns(rest, { nameWithOwner: 'kedrzu/githq' });

    const expected: ListRepositoryRunsResult = { status: 200, etag: '"def"' };
    expect(result).toEqual(expected);
    expect(new Headers(requests[0]?.[1]?.headers).has('If-None-Match')).toBe(false);
});

test('throws when GitHub refuses', async () => {
    const rest = restAnswering(Response.json({ message: 'Not Found' }, { status: 404 }));

    await expect(listRepositoryRuns(rest, { nameWithOwner: 'kedrzu/githq' })).rejects.toBeInstanceOf(GitHubApiError);
});

function restAnswering(response: Response, requests: Parameters<Fetch>[] = []) {
    const fetch: Fetch = (...request) => {
        requests.push(request);
        return Promise.resolve(response);
    };

    return createGitHubRestRequester({ getToken: () => 'gho_token', fetch });
}
