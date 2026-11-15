import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { cancelWorkflowRun } from './cancelWorkflowRun.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';

const PARAMS = { nameWithOwner: 'kedrzu/githq', runId: 41_507_834_451 };

test('asks GitHub to cancel the run', async () => {
    const requests: Parameters<Fetch>[] = [];

    await cancelWorkflowRun(restAnswering(Response.json({}, { status: 202 }), requests), PARAMS);

    const [input, init] = requests[0] ?? [];
    expect(input).toBe('https://api.github.com/repos/kedrzu/githq/actions/runs/41507834451/cancel');
    expect(init?.method).toBe('POST');
});

function restAnswering(response: Response, requests: Parameters<Fetch>[] = []) {
    const fetch: Fetch = (...request) => {
        requests.push(request);
        return Promise.resolve(response);
    };

    return createGitHubRestRequester({ getToken: () => 'gho_token', fetch });
}
