import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { getRepositoryConditional } from './getRepositoryConditional.js';

test('asks the repository with the held ETag and reports 304 while it did not change', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering(new Response(null, { status: 304, headers: { etag: '"abc"' } }), requests);

    expect(await getRepositoryConditional(rest, { nameWithOwner: 'kedrzu/githq', etag: '"abc"' })).toEqual({
        status: 304,
    });
    const [input, init] = requests[0] ?? [];
    expect(input).toBe('https://api.github.com/repos/kedrzu/githq');
    expect(new Headers(init?.headers).get('If-None-Match')).toBe('"abc"');
});

test('returns the default branch and the new ETag once the repository changed', async () => {
    const rest = restAnswering(
        Response.json(
            { id: 1_381_159_446, full_name: 'kedrzu/githq', default_branch: 'main', private: false },
            { headers: { etag: '"def"' } },
        ),
    );

    expect(await getRepositoryConditional(rest, { nameWithOwner: 'kedrzu/githq' })).toEqual({
        status: 200,
        etag: '"def"',
        defaultBranch: 'main',
    });
});

test.each([
    ['a repository that is gone', Response.json({ message: 'Not Found' }, { status: 404 })],
    ['an answer without a default branch', Response.json({ id: 1, default_branch: null })],
])('throws on %s', async (_, response) => {
    const rest = restAnswering(response);

    await expect(getRepositoryConditional(rest, { nameWithOwner: 'kedrzu/githq' })).rejects.toBeInstanceOf(
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
