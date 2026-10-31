import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { listRepositoryIssuesSince } from './listRepositoryIssuesSince.js';
import type { ListRepositoryIssuesSinceResult } from './listRepositoryIssuesSince.js';

const SINCE = '2026-10-30T10:00:00Z';
const NEXT_URL =
    'https://api.github.com/repositories/1381159446/issues?state=all&since=2026-10-30T10%3A00%3A00Z&per_page=100&sort=updated&direction=desc&after=Y3Vy&page=2';

test('sends the held ETag and reports 304 without reading further while nothing changed', async () => {
    const requests: Parameters<Fetch>[] = [];
    // GitHub's 304 carries the ETag but no body and no `Link`.
    const rest = restAnswering([new Response(null, { status: 304, headers: { etag: '"abc"' } })], requests);

    const result = await listRepositoryIssuesSince(rest, {
        owner: 'kedrzu',
        name: 'githq',
        since: SINCE,
        etag: '"abc"',
    });

    expect(result).toEqual({ status: 304 });
    expect(requests).toHaveLength(1);
    const [input, init] = requests[0] ?? [];
    const url = new URL(typeof input === 'string' ? input : '');
    expect(url.origin + url.pathname).toBe('https://api.github.com/repos/kedrzu/githq/issues');
    expect(Object.fromEntries(url.searchParams)).toEqual({
        state: 'all',
        since: SINCE,
        per_page: '100',
        sort: 'updated',
        direction: 'desc',
    });
    expect(new Headers(init?.headers).get('If-None-Match')).toBe('"abc"');
});

test('follows the Link header through every page and keeps the first page ETag', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering(
        [
            Response.json(
                [
                    {
                        node_id: 'PR_kwDOAAAB',
                        number: 36,
                        updated_at: '2026-10-30T16:54:49Z',
                        pull_request: { url: 'https://api.github.com/repos/kedrzu/githq/pulls/36', merged_at: null },
                        title: 'Fields the result does not keep are ignored',
                    },
                ],
                { headers: { etag: '"first"', link: `<${NEXT_URL}>; rel="next", <${NEXT_URL}>; rel="last"` } },
            ),
            Response.json([{ node_id: 'I_kwDOAAAC', number: 4, updated_at: '2026-10-30T11:00:00Z' }], {
                headers: { etag: '"second"' },
            }),
        ],
        requests,
    );

    const result = await listRepositoryIssuesSince(rest, {
        owner: 'kedrzu',
        name: 'githq',
        since: SINCE,
        etag: '"old"',
    });

    const expected: ListRepositoryIssuesSinceResult = {
        status: 200,
        etag: '"first"',
        items: [
            { nodeId: 'PR_kwDOAAAB', number: 36, updatedAt: '2026-10-30T16:54:49Z', isPullRequest: true },
            { nodeId: 'I_kwDOAAAC', number: 4, updatedAt: '2026-10-30T11:00:00Z', isPullRequest: false },
        ],
    };
    expect(result).toEqual(expected);
    expect(requests).toHaveLength(2);
    const [input, init] = requests[1] ?? [];
    expect(input).toBe(NEXT_URL);
    // Only the first page is conditional: its ETag alone tells whether anything changed.
    expect(new Headers(init?.headers).has('If-None-Match')).toBe(false);
});

test('asks unconditionally when no ETag is held', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering([Response.json([])], requests);

    expect(await listRepositoryIssuesSince(rest, { owner: 'kedrzu', name: 'githq', since: SINCE })).toEqual({
        status: 200,
        etag: undefined,
        items: [],
    });
    expect(new Headers(requests[0]?.[1]?.headers).has('If-None-Match')).toBe(false);
});

test.each([
    ['not a list', { message: 'Moved Permanently' }],
    ['a hit without its node id', [{ number: 4, updated_at: '2026-10-30T11:00:00Z' }]],
])('throws on an answer that is %s', async (_, body) => {
    const rest = restAnswering([Response.json(body)]);

    await expect(
        listRepositoryIssuesSince(rest, { owner: 'kedrzu', name: 'githq', since: SINCE }),
    ).rejects.toBeInstanceOf(GitHubApiError);
});

function restAnswering(responses: Response[], requests: Parameters<Fetch>[] = []) {
    const queue = [...responses];
    const fetch: Fetch = (...request) => {
        requests.push(request);
        const response = queue.shift();
        return response ? Promise.resolve(response) : Promise.reject(new Error('No more answers'));
    };

    return createGitHubRestRequester({ getToken: () => 'gho_token', fetch });
}
