import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { requestAsyncMerge } from './requestAsyncMerge.js';
import type { RequestAsyncMergeParams } from './requestAsyncMerge.js';

const PARAMS: RequestAsyncMergeParams = {
    owner: 'nzymejs',
    name: 'githq-merge-sandbox',
    number: 7,
    mergeMethod: 'squash',
    sha: 'f66a',
};

// As GitHub answered on nzymejs/githq-merge-sandbox (2026-11-02).
const ENQUEUED = {
    status: 'pending',
    details: {
        message: 'Merge request enqueued.',
        uuid: 'b904',
        merge_method: 'squash',
        merge_action: 'default',
        expected_head_sha: 'f66a',
        bypass_rules: false,
    },
};

test('asks for the merge with the method and the head, and no title or message keys unless given', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering(() => Response.json(ENQUEUED, { status: 202 }), requests);

    expect(await requestAsyncMerge(rest, PARAMS)).toEqual({ status: 'pending', uuid: 'b904' });

    const [input, init] = requests[0] ?? [];
    expect(input).toBe('https://api.github.com/repos/nzymejs/githq-merge-sandbox/pulls/7/merge-async');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '')).toEqual({
        merge_method: 'squash',
        sha: 'f66a',
    });
});

test('sends the commit title and message when given', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering(() => Response.json(ENQUEUED, { status: 202 }), requests);

    await requestAsyncMerge(rest, {
        ...PARAMS,
        mergeMethod: 'merge',
        commitTitle: 'Merge #7',
        commitMessage: '',
    });

    const [, init] = requests[0] ?? [];
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '')).toEqual({
        merge_method: 'merge',
        sha: 'f66a',
        commit_title: 'Merge #7',
        commit_message: '',
    });
});

test("a merge GitHub refuses with a failed answer comes back failed, in GitHub's words", async () => {
    const rest = restAnswering(() =>
        Response.json(
            { status: 'failed', details: { message: 'Pull request head branch was modified.' } },
            { status: 400 },
        ),
    );

    expect(await requestAsyncMerge(rest, PARAMS)).toEqual({
        status: 'failed',
        message: 'Pull request head branch was modified.',
    });
});

test('a merge already running answers 409 with its uuid: it comes back pending, to follow', async () => {
    const rest = restAnswering(() =>
        Response.json(
            { status: 'pending', details: { message: 'Merge request is in progress.', uuid: 'b904' } },
            { status: 409 },
        ),
    );

    expect(await requestAsyncMerge(rest, PARAMS)).toEqual({ status: 'pending', uuid: 'b904' });
});

test('a merge put in the merge queue comes back enqueued', async () => {
    const rest = restAnswering(() =>
        Response.json({ status: 'enqueued', details: { message: 'Added to the merge queue.' } }, { status: 202 }),
    );

    expect(await requestAsyncMerge(rest, PARAMS)).toEqual({ status: 'enqueued' });
});

test.each([
    ['a refusal of another shape', () => Response.json({ message: 'Not Found' }, { status: 404 })],
    ['a server error', () => new Response('', { status: 502 })],
])('throws on %s', async (_, answer) => {
    const rest = restAnswering(answer);

    await expect(requestAsyncMerge(rest, PARAMS)).rejects.toBeInstanceOf(GitHubApiError);
});

test.each([
    ['an unknown status', { status: 'queued', details: { message: 'Something new.' } }],
    ['a pending answer without its uuid', { status: 'pending', details: { message: 'Merge request enqueued.' } }],
    ['no details', { status: 'merged' }],
])('throws on an answer with %s', async (_, body) => {
    const rest = restAnswering(() => Response.json(body, { status: 202 }));

    await expect(requestAsyncMerge(rest, PARAMS)).rejects.toMatchObject({
        message: 'GitHub merge answer is malformed',
    });
});

function restAnswering(answer: () => Response, requests: Parameters<Fetch>[] = []) {
    const fetch: Fetch = (...request) => {
        requests.push(request);
        return Promise.resolve(answer());
    };

    return createGitHubRestRequester({ getToken: () => 'gho_token', fetch });
}
