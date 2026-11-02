import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { listWorkflows } from './listWorkflows.js';
import type { ListWorkflowsResult } from './listWorkflows.js';

const NEXT_URL = 'https://api.github.com/repositories/1381159446/actions/workflows?per_page=100&page=2';

/** A workflow as GitHub answers it, with fields githq does not keep. */
const DEPLOY = {
    id: 402_954_726,
    node_id: 'W_kwDOAAAB',
    name: 'Deploy',
    path: '.github/workflows/deploy.yml',
    state: 'active',
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
    html_url: 'https://github.com/kedrzu/githq/blob/main/.github/workflows/deploy.yml',
    badge_url: 'https://github.com/kedrzu/githq/workflows/Deploy/badge.svg',
};

test('sends the held ETag and reports 304 while the workflows did not change', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering([new Response(null, { status: 304, headers: { etag: '"abc"' } })], requests);

    expect(await listWorkflows(rest, { nameWithOwner: 'kedrzu/githq', etag: '"abc"' })).toEqual({ status: 304 });
    expect(requests).toHaveLength(1);
    const [input, init] = requests[0] ?? [];
    expect(input).toBe('https://api.github.com/repos/kedrzu/githq/actions/workflows?per_page=100');
    expect(new Headers(init?.headers).get('If-None-Match')).toBe('"abc"');
});

test('follows the Link header through every page and keeps the first page ETag', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering(
        [
            Response.json(
                { total_count: 2, workflows: [DEPLOY] },
                { headers: { etag: '"first"', link: `<${NEXT_URL}>; rel="next", <${NEXT_URL}>; rel="last"` } },
            ),
            Response.json(
                {
                    total_count: 2,
                    workflows: [
                        {
                            ...DEPLOY,
                            id: 5,
                            name: 'pages-build-deployment',
                            path: 'dynamic/pages/pages-build-deployment',
                            state: 'disabled_manually',
                            html_url: 'https://github.com/kedrzu/githq/actions/workflows/pages',
                        },
                    ],
                },
                { headers: { etag: '"second"' } },
            ),
        ],
        requests,
    );

    const expected: ListWorkflowsResult = {
        status: 200,
        etag: '"first"',
        workflows: [
            {
                id: 402_954_726,
                name: 'Deploy',
                path: '.github/workflows/deploy.yml',
                state: 'active',
                htmlUrl: 'https://github.com/kedrzu/githq/blob/main/.github/workflows/deploy.yml',
            },
            {
                id: 5,
                name: 'pages-build-deployment',
                path: 'dynamic/pages/pages-build-deployment',
                state: 'disabled_manually',
                htmlUrl: 'https://github.com/kedrzu/githq/actions/workflows/pages',
            },
        ],
    };
    expect(await listWorkflows(rest, { nameWithOwner: 'kedrzu/githq', etag: '"old"' })).toEqual(expected);
    expect(requests[1]?.[0]).toBe(NEXT_URL);
    expect(new Headers(requests[1]?.[1]?.headers).has('If-None-Match')).toBe(false);
});

test.each([
    ['refused', Response.json({ message: 'Forbidden' }, { status: 403 })],
    ['not a workflow list', Response.json([DEPLOY])],
    ['a workflow without its state', Response.json({ total_count: 1, workflows: [{ ...DEPLOY, state: null }] })],
])('throws on an answer that is %s', async (_, response) => {
    const rest = restAnswering([response]);

    await expect(listWorkflows(rest, { nameWithOwner: 'kedrzu/githq' })).rejects.toBeInstanceOf(GitHubApiError);
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
