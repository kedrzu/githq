import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { dispatchWorkflow } from './dispatchWorkflow.js';
import type { DispatchWorkflowResult } from './dispatchWorkflow.js';

const PARAMS = { nameWithOwner: 'kedrzu/githq', workflowId: 402_954_726, ref: 'main' };

test('runs the workflow on the ref with the inputs, and answers the run it started', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering(
        Response.json({
            workflow_run_id: 41_507_834_451,
            run_url: 'https://api.github.com/repos/kedrzu/githq/actions/runs/41507834451',
            html_url: 'https://github.com/kedrzu/githq/actions/runs/41507834451',
        }),
        requests,
    );

    const result = await dispatchWorkflow(rest, { ...PARAMS, inputs: { environment: 'staging', dryRun: true } });

    const expected: DispatchWorkflowResult = {
        runId: 41_507_834_451,
        htmlUrl: 'https://github.com/kedrzu/githq/actions/runs/41507834451',
    };
    expect(result).toEqual(expected);
    const [input, init] = requests[0] ?? [];
    expect(input).toBe('https://api.github.com/repos/kedrzu/githq/actions/workflows/402954726/dispatches');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '')).toEqual({
        ref: 'main',
        inputs: { environment: 'staging', dryRun: true },
        return_run_details: true,
    });
});

test('sends no inputs when none are given, so the workflow takes its defaults', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering(Response.json({ workflow_run_id: 1, run_url: 'u', html_url: 'h' }), requests);

    await dispatchWorkflow(rest, PARAMS);

    const init = requests[0]?.[1];
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '')).toEqual({
        ref: 'main',
        return_run_details: true,
    });
});

test('throws on an answer naming no run', async () => {
    const rest = restAnswering(new Response(null, { status: 204 }));

    await expect(dispatchWorkflow(rest, PARAMS)).rejects.toBeInstanceOf(GitHubApiError);
});

function restAnswering(response: Response, requests: Parameters<Fetch>[] = []) {
    const fetch: Fetch = (...request) => {
        requests.push(request);
        return Promise.resolve(response);
    };

    return createGitHubRestRequester({ getToken: () => 'gho_token', fetch });
}
