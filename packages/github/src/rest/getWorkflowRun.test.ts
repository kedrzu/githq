import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { getWorkflowRun } from './getWorkflowRun.js';

/** A run as GitHub answers it, with fields githq does not keep. */
const RUN = {
    id: 41_507_834_451,
    name: 'Deploy',
    head_branch: 'main',
    head_sha: 'af427d1b0fb8f9fc00e6ee5d05578fbc19f1e2c0',
    run_number: 212,
    event: 'push',
    status: 'completed',
    conclusion: 'failure',
    workflow_id: 402_954_726,
    html_url: 'https://github.com/kedrzu/githq/actions/runs/41507834451',
    created_at: '2026-11-02T19:12:51Z',
    display_title: 'fix(web): grow the track pickers',
    run_started_at: '2026-11-02T19:12:51Z',
    updated_at: '2026-11-02T19:18:45Z',
    head_commit: { id: 'af427d1', message: 'fix(web): grow the track pickers\n\nThe dialogs.' },
    actor: { login: 'kedrzu', id: 1 },
};

const PARAMS = { nameWithOwner: 'kedrzu/githq', runId: 41_507_834_451 };

test('reads the run with what its summary needs, and sends the held ETag', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering([Response.json(RUN, { headers: { etag: '"abc"' } })], requests);

    const result = await getWorkflowRun(rest, { ...PARAMS, etag: '"old"' });

    expect(result).toMatchObject({
        status: 200,
        etag: '"abc"',
        run: {
            id: 41_507_834_451,
            workflowId: 402_954_726,
            workflowName: 'Deploy',
            headBranch: 'main',
            event: 'push',
            conclusion: 'failure',
            headSha: 'af427d1b0fb8f9fc00e6ee5d05578fbc19f1e2c0',
            headCommitMessage: 'fix(web): grow the track pickers\n\nThe dialogs.',
            actorLogin: 'kedrzu',
        },
    });
    const [input, init] = requests[0] ?? [];
    expect(input).toBe('https://api.github.com/repos/kedrzu/githq/actions/runs/41507834451');
    expect(new Headers(init?.headers).get('If-None-Match')).toBe('"old"');
});

test('a run without a name, commit or actor still reads, those told as unknown', async () => {
    const rest = restAnswering([Response.json({ ...RUN, name: null, head_commit: null, actor: undefined })]);

    expect(await getWorkflowRun(rest, PARAMS)).toMatchObject({
        run: { workflowName: null, headCommitMessage: null, actorLogin: null },
    });
});

test('reports 304 while the run did not move', async () => {
    const rest = restAnswering([new Response(null, { status: 304 })]);

    expect(await getWorkflowRun(rest, { ...PARAMS, etag: '"abc"' })).toEqual({ status: 304 });
});

test('a run GitHub no longer has is gone, not a failure', async () => {
    const rest = restAnswering([Response.json({ message: 'Not Found' }, { status: 404 })]);

    expect(await getWorkflowRun(rest, PARAMS)).toEqual({ status: 'gone' });
});

test.each([
    ['refused', Response.json({ message: 'Server Error' }, { status: 502 })],
    ['not an object', Response.json([RUN])],
    ['a run without its id', Response.json({ ...RUN, id: null })],
])('throws on an answer that is %s', async (_, response) => {
    await expect(getWorkflowRun(restAnswering([response]), PARAMS)).rejects.toBeInstanceOf(GitHubApiError);
});

function restAnswering(responses: Response[], requests: Parameters<Fetch>[] = []) {
    const fetch: Fetch = (...request) => {
        requests.push(request);
        const response = responses.shift();
        return response ? Promise.resolve(response) : Promise.reject(new Error('No more answers'));
    };

    return createGitHubRestRequester({ getToken: () => 'gho_token', fetch });
}
