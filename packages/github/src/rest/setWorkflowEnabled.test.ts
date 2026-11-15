import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { setWorkflowEnabled } from './setWorkflowEnabled.js';

test.each([
    [true, 'enable'],
    [false, 'disable'],
])('enabled: %p asks GitHub to %s the workflow', async (enabled, action) => {
    const requests: Parameters<Fetch>[] = [];

    await setWorkflowEnabled(restAnswering(new Response(null, { status: 204 }), requests), {
        nameWithOwner: 'kedrzu/githq',
        workflowId: 402_954_726,
        enabled,
    });

    const [input, init] = requests[0] ?? [];
    expect(input).toBe(`https://api.github.com/repos/kedrzu/githq/actions/workflows/402954726/${action}`);
    expect(init?.method).toBe('PUT');
});

function restAnswering(response: Response, requests: Parameters<Fetch>[] = []) {
    const fetch: Fetch = (...request) => {
        requests.push(request);
        return Promise.resolve(response);
    };

    return createGitHubRestRequester({ getToken: () => 'gho_token', fetch });
}
