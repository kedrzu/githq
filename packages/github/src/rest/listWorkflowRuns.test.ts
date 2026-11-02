import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { listWorkflowRuns } from './listWorkflowRuns.js';
import type { ListWorkflowRunsResult } from './listWorkflowRuns.js';

const NEXT_URL =
    'https://api.github.com/repositories/1381159446/actions/workflows/402954726/runs?branch=v0.1.0-rc.3&per_page=3&page=2';

/** A run as GitHub answers it, with fields githq does not keep. */
const RUN = {
    id: 18_901_234_567,
    name: 'Release',
    head_branch: 'v0.1.0-rc.3',
    head_sha: '61d449d0c1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6',
    run_number: 3,
    event: 'push',
    status: 'completed',
    conclusion: 'success',
    workflow_id: 402_954_726,
    html_url: 'https://github.com/kedrzu/githq/actions/runs/18901234567',
    created_at: '2026-11-01T03:00:00Z',
};

test('asks one exact branch with the held ETag and reports 304 while its runs did not move', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering([new Response(null, { status: 304, headers: { etag: '"abc"' } })], requests);

    const result = await listWorkflowRuns(rest, {
        nameWithOwner: 'kedrzu/githq',
        workflowId: 402_954_726,
        branch: 'v0.1.0-rc.3',
        perPage: 3,
        etag: '"abc"',
    });

    expect(result).toEqual({ status: 304 });
    const [input, init] = requests[0] ?? [];
    expect(input).toBe(
        'https://api.github.com/repos/kedrzu/githq/actions/workflows/402954726/runs?branch=v0.1.0-rc.3&per_page=3',
    );
    expect(new Headers(init?.headers).get('If-None-Match')).toBe('"abc"');
});

test('returns one page of runs with the next page URL from the Link header', async () => {
    const rest = restAnswering([
        Response.json(
            { total_count: 4, workflow_runs: [RUN] },
            { headers: { etag: '"def"', link: `<${NEXT_URL}>; rel="next", <${NEXT_URL}>; rel="last"` } },
        ),
    ]);

    const expected: ListWorkflowRunsResult = {
        status: 200,
        etag: '"def"',
        runs: [
            {
                id: 18_901_234_567,
                workflowId: 402_954_726,
                runNumber: 3,
                headBranch: 'v0.1.0-rc.3',
                event: 'push',
                status: 'completed',
                conclusion: 'success',
                createdAt: '2026-11-01T03:00:00Z',
                htmlUrl: 'https://github.com/kedrzu/githq/actions/runs/18901234567',
                headSha: '61d449d0c1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6',
            },
        ],
        nextPageUrl: NEXT_URL,
    };
    expect(
        await listWorkflowRuns(rest, { nameWithOwner: 'kedrzu/githq', workflowId: 402_954_726, branch: 'v0.1.0-rc.3' }),
    ).toEqual(expected);
});

test('asks the page URL it is given as it is, and every ref when no branch is named', async () => {
    const requests: Parameters<Fetch>[] = [];
    const empty = { total_count: 0, workflow_runs: [] };
    const rest = restAnswering([Response.json(empty), Response.json(empty)], requests);

    expect(
        await listWorkflowRuns(rest, {
            nameWithOwner: 'kedrzu/githq',
            workflowId: 402_954_726,
            branch: 'main',
            perPage: 10,
            pageUrl: NEXT_URL,
        }),
    ).toEqual({ status: 200, etag: undefined, runs: [], nextPageUrl: undefined });
    await listWorkflowRuns(rest, { nameWithOwner: 'kedrzu/githq', workflowId: 402_954_726 });

    expect(requests.map(([input]) => input)).toEqual([
        NEXT_URL,
        'https://api.github.com/repos/kedrzu/githq/actions/workflows/402954726/runs',
    ]);
});

test.each([
    ['refused', Response.json({ message: 'Not Found' }, { status: 404 })],
    ['not a run list', Response.json({ total_count: 1 })],
    [
        'a run without its creation time',
        Response.json({ total_count: 1, workflow_runs: [{ ...RUN, created_at: null }] }),
    ],
])('throws on an answer that is %s', async (_, response) => {
    const rest = restAnswering([response]);

    await expect(
        listWorkflowRuns(rest, { nameWithOwner: 'kedrzu/githq', workflowId: 402_954_726 }),
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
