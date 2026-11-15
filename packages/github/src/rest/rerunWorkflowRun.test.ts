import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { rerunWorkflowRun } from './rerunWorkflowRun.js';

test('asks GitHub to re-run the whole run', async () => {
    const requests: Parameters<Fetch>[] = [];

    await rerunWorkflowRun(restAnswering(Response.json({}, { status: 201 }), requests), {
        nameWithOwner: 'kedrzu/githq',
        runId: 41_507_834_451,
    });

    const [input, init] = requests[0] ?? [];
    expect(input).toBe('https://api.github.com/repos/kedrzu/githq/actions/runs/41507834451/rerun');
    expect(init?.method).toBe('POST');
});

function restAnswering(response: Response, requests: Parameters<Fetch>[] = []) {
    const fetch: Fetch = (...request) => {
        requests.push(request);
        return Promise.resolve(response);
    };

    return createGitHubRestRequester({ getToken: () => 'gho_token', fetch });
}
