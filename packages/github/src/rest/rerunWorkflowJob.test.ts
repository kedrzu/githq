import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { rerunWorkflowJob } from './rerunWorkflowJob.js';

test('asks GitHub to re-run the job', async () => {
    const requests: Parameters<Fetch>[] = [];

    await rerunWorkflowJob(restAnswering(Response.json({}, { status: 201 }), requests), {
        nameWithOwner: 'kedrzu/githq',
        jobId: 117_294_553_301,
    });

    const [input, init] = requests[0] ?? [];
    expect(input).toBe('https://api.github.com/repos/kedrzu/githq/actions/jobs/117294553301/rerun');
    expect(init?.method).toBe('POST');
});

function restAnswering(response: Response, requests: Parameters<Fetch>[] = []) {
    const fetch: Fetch = (...request) => {
        requests.push(request);
        return Promise.resolve(response);
    };

    return createGitHubRestRequester({ getToken: () => 'gho_token', fetch });
}
