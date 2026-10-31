import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { searchIssues } from './searchIssues.js';
import type { SearchIssuesResult } from './searchIssues.js';

test('searches with the query, the newest change first, and reads the hits', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering(
        Response.json({
            total_count: 2,
            incomplete_results: false,
            items: [
                {
                    node_id: 'PR_kwDOAAAB',
                    number: 5,
                    updated_at: '2026-10-30T10:00:00Z',
                    repository_url: 'https://api.github.com/repos/kedrzu/githq',
                    pull_request: { url: 'https://api.github.com/repos/kedrzu/githq/pulls/5', merged_at: null },
                    title: 'Fields the result does not keep are ignored',
                },
                {
                    node_id: 'I_kwDOAAAC',
                    number: 21,
                    updated_at: '2026-10-29T08:30:00Z',
                    repository_url: 'https://api.github.com/repos/kedrzu/cook-app',
                },
            ],
        }),
        requests,
    );

    const result = await searchIssues(rest, { q: 'is:open is:pr author:@me' });

    const expected: SearchIssuesResult = {
        totalCount: 2,
        incompleteResults: false,
        items: [
            {
                nodeId: 'PR_kwDOAAAB',
                number: 5,
                updatedAt: '2026-10-30T10:00:00Z',
                isPullRequest: true,
                repositoryFullName: 'kedrzu/githq',
            },
            {
                nodeId: 'I_kwDOAAAC',
                number: 21,
                updatedAt: '2026-10-29T08:30:00Z',
                isPullRequest: false,
                repositoryFullName: 'kedrzu/cook-app',
            },
        ],
    };
    expect(result).toEqual(expected);

    const [input, init] = requests[0] ?? [];
    const url = new URL(typeof input === 'string' ? input : '');
    expect(url.origin + url.pathname).toBe('https://api.github.com/search/issues');
    expect(Object.fromEntries(url.searchParams)).toEqual({
        q: 'is:open is:pr author:@me',
        per_page: '100',
        sort: 'updated',
        order: 'desc',
    });
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer gho_token');
    // Search answers have no ETag: nothing to make the request conditional with.
    expect(new Headers(init?.headers).has('If-None-Match')).toBe(false);
});

test.each([
    ['no items', { total_count: 0, incomplete_results: false }],
    [
        'a hit without its node id',
        {
            total_count: 1,
            incomplete_results: false,
            items: [
                { number: 5, updated_at: '2026-10-30T10:00:00Z', repository_url: 'https://api.github.com/repos/a/b' },
            ],
        },
    ],
])('throws on an answer with %s', async (_, body) => {
    const rest = restAnswering(Response.json(body));

    await expect(searchIssues(rest, { q: 'is:open' })).rejects.toBeInstanceOf(GitHubApiError);
});

function restAnswering(response: Response, requests: Parameters<Fetch>[] = []) {
    const fetch: Fetch = (...request) => {
        requests.push(request);
        return Promise.resolve(response);
    };

    return createGitHubRestRequester({ getToken: () => 'gho_token', fetch });
}
