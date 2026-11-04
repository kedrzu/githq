import { expect, test } from 'bun:test';

import type { GitHubRestRequest } from './createGitHubRestRequester.js';
import { rerunFailedJobs } from './rerunFailedJobs.js';

test('asks GitHub to re-run the failed jobs of the run', async () => {
    const requests: GitHubRestRequest[] = [];

    await rerunFailedJobs(
        request => {
            requests.push(request);
            return Promise.resolve({
                status: 201,
                payload: {},
                text: '',
                headers: new Headers(),
                retryAfter: undefined,
            });
        },
        { owner: 'acme', name: 'web', runId: 42 },
    );

    expect(requests).toEqual([{ method: 'POST', url: '/repos/acme/web/actions/runs/42/rerun-failed-jobs' }]);
});
