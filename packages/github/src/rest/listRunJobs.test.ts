import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { listRunJobs } from './listRunJobs.js';

const NEXT_URL = 'https://api.github.com/repositories/1/actions/runs/41507834451/jobs?per_page=100&page=2';
const PARAMS = { nameWithOwner: 'kedrzu/githq', runId: 41_507_834_451 };

/** A job as GitHub answers it, with fields githq does not keep. */
const JOB = {
    id: 125_492_293_728,
    run_id: 41_507_834_451,
    name: 'deploy',
    status: 'completed',
    conclusion: 'failure',
    started_at: '2026-11-02T19:14:17Z',
    completed_at: '2026-11-02T19:18:35Z',
    html_url: 'https://github.com/kedrzu/githq/actions/runs/41507834451/job/125492293728',
    steps: [
        {
            name: 'Set up job',
            status: 'completed',
            conclusion: 'success',
            number: 1,
            started_at: '2026-11-02T19:14:19Z',
            completed_at: '2026-11-02T19:14:20Z',
        },
        { name: 'E2E', status: 'pending', conclusion: null, number: 15 },
    ],
};

test('asks 100 a page with the held ETag and reports 304 while the jobs did not move', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering([new Response(null, { status: 304 })], requests);

    expect(await listRunJobs(rest, { ...PARAMS, etag: '"abc"' })).toEqual({ status: 304 });

    const [input, init] = requests[0] ?? [];
    expect(input).toBe('https://api.github.com/repos/kedrzu/githq/actions/runs/41507834451/jobs?per_page=100');
    expect(new Headers(init?.headers).get('If-None-Match')).toBe('"abc"');
});

test('reads a job with its steps, a step’s missing times and a step number’s gap as they are', async () => {
    const rest = restAnswering([Response.json({ total_count: 1, jobs: [JOB] }, { headers: { etag: '"def"' } })]);

    expect(await listRunJobs(rest, PARAMS)).toEqual({
        status: 200,
        etag: '"def"',
        jobs: [
            {
                id: 125_492_293_728,
                name: 'deploy',
                status: 'completed',
                conclusion: 'failure',
                startedAt: '2026-11-02T19:14:17Z',
                completedAt: '2026-11-02T19:18:35Z',
                htmlUrl: 'https://github.com/kedrzu/githq/actions/runs/41507834451/job/125492293728',
                steps: [
                    {
                        name: 'Set up job',
                        number: 1,
                        status: 'completed',
                        conclusion: 'success',
                        startedAt: '2026-11-02T19:14:19Z',
                        completedAt: '2026-11-02T19:14:20Z',
                    },
                    {
                        name: 'E2E',
                        number: 15,
                        status: 'pending',
                        conclusion: null,
                        startedAt: null,
                        completedAt: null,
                    },
                ],
            },
        ],
    });
});

test('follows the `Link` through every page, keeping the first page’s ETag', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering(
        [
            Response.json(
                { total_count: 2, jobs: [JOB] },
                { headers: { etag: '"first"', link: `<${NEXT_URL}>; rel="next"` } },
            ),
            Response.json(
                { total_count: 2, jobs: [{ ...JOB, id: 2, steps: undefined }] },
                { headers: { etag: '"second"' } },
            ),
        ],
        requests,
    );

    const result = await listRunJobs(rest, PARAMS);

    expect(result).toMatchObject({ status: 200, etag: '"first"' });
    expect(result.status === 200 && result.jobs.map(job => [job.id, job.steps.length])).toEqual([
        [125_492_293_728, 2],
        [2, 0],
    ]);
    expect(requests[1]?.[0]).toBe(NEXT_URL);
});

test('a run GitHub no longer has is gone, not a failure', async () => {
    const rest = restAnswering([Response.json({ message: 'Not Found' }, { status: 404 })]);

    expect(await listRunJobs(rest, PARAMS)).toEqual({ status: 'gone' });
});

test.each([
    ['refused', Response.json({ message: 'Forbidden' }, { status: 403 })],
    ['not a job list', Response.json({ total_count: 1 })],
    ['a job without its id', Response.json({ jobs: [{ ...JOB, id: '1' }] })],
    ['a job without its link', Response.json({ jobs: [{ ...JOB, html_url: null }] })],
    ['a job whose steps are no list', Response.json({ jobs: [{ ...JOB, steps: {} }] })],
    ['a step without its number', Response.json({ jobs: [{ ...JOB, steps: [{ ...JOB.steps[0], number: null }] }] })],
    ['a step with a time not text', Response.json({ jobs: [{ ...JOB, steps: [{ ...JOB.steps[0], started_at: 1 }] }] })],
])('throws on an answer that is %s', async (_, response) => {
    await expect(listRunJobs(restAnswering([response]), PARAMS)).rejects.toBeInstanceOf(GitHubApiError);
});

function restAnswering(responses: Response[], requests: Parameters<Fetch>[] = []) {
    const fetch: Fetch = (...request) => {
        requests.push(request);
        const response = responses.shift();
        return response ? Promise.resolve(response) : Promise.reject(new Error('No more answers'));
    };

    return createGitHubRestRequester({ getToken: () => 'gho_token', fetch });
}
