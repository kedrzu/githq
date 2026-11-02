import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { listRepositoryRuns } from './listRepositoryRuns.js';
import type { ListRepositoryRunsResult } from './listRepositoryRuns.js';

/** A run as GitHub answers it, with fields githq does not keep. */
const RUN = {
    id: 18_901_234_567,
    name: 'Deploy',
    node_id: 'WFR_kwLOAAAB',
    head_branch: 'main',
    head_sha: '61d449d0c1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6',
    run_number: 23,
    event: 'push',
    status: 'completed',
    conclusion: 'failure',
    workflow_id: 402_954_726,
    html_url: 'https://github.com/kedrzu/githq/actions/runs/18901234567',
    created_at: '2026-11-01T03:00:00Z',
    updated_at: '2026-11-01T03:04:00Z',
    run_attempt: 1,
};

test('sends the held ETag for a small page and reports 304 while no run moved', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering(new Response(null, { status: 304, headers: { etag: '"abc"' } }), requests);

    const result = await listRepositoryRuns(rest, { nameWithOwner: 'kedrzu/githq', etag: '"abc"' });

    expect(result).toEqual({ status: 304 });
    const [input, init] = requests[0] ?? [];
    expect(input).toBe('https://api.github.com/repos/kedrzu/githq/actions/runs?per_page=10');
    expect(new Headers(init?.headers).get('If-None-Match')).toBe('"abc"');
});

test('returns the runs and the new ETag once a run moved', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering(
        Response.json(
            { total_count: 1, workflow_runs: [{ ...RUN, head_branch: null, conclusion: null, status: 'queued' }] },
            { headers: { etag: '"def"' } },
        ),
        requests,
    );

    const result = await listRepositoryRuns(rest, { nameWithOwner: 'kedrzu/githq', perPage: 3 });

    const expected: ListRepositoryRunsResult = {
        status: 200,
        etag: '"def"',
        runs: [
            {
                id: 18_901_234_567,
                workflowId: 402_954_726,
                runNumber: 23,
                headBranch: null,
                event: 'push',
                status: 'queued',
                conclusion: null,
                createdAt: '2026-11-01T03:00:00Z',
                htmlUrl: 'https://github.com/kedrzu/githq/actions/runs/18901234567',
                headSha: '61d449d0c1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6',
            },
        ],
    };
    expect(result).toEqual(expected);
    expect(requests[0]?.[0]).toBe('https://api.github.com/repos/kedrzu/githq/actions/runs?per_page=3');
    expect(new Headers(requests[0]?.[1]?.headers).has('If-None-Match')).toBe(false);
});

test.each([
    ['refused', Response.json({ message: 'Not Found' }, { status: 404 })],
    ['not a run list', Response.json([RUN])],
    [
        'a run without its workflow',
        Response.json({ total_count: 1, workflow_runs: [{ ...RUN, workflow_id: undefined }] }),
    ],
    [
        'a run with a conclusion that is not text',
        Response.json({ total_count: 1, workflow_runs: [{ ...RUN, conclusion: 1 }] }),
    ],
])('throws on an answer that is %s', async (_, response) => {
    const rest = restAnswering(response);

    await expect(listRepositoryRuns(rest, { nameWithOwner: 'kedrzu/githq' })).rejects.toBeInstanceOf(GitHubApiError);
});

function restAnswering(response: Response, requests: Parameters<Fetch>[] = []) {
    const fetch: Fetch = (...request) => {
        requests.push(request);
        return Promise.resolve(response);
    };

    return createGitHubRestRequester({ getToken: () => 'gho_token', fetch });
}
