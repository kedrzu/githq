import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { readAsyncMerge } from './readAsyncMerge.js';
import type { ReadAsyncMergeParams } from './readAsyncMerge.js';

const PARAMS: ReadAsyncMergeParams = { owner: 'nzymejs', name: 'githq-merge-sandbox', number: 7, uuid: 'b904' };

test('reads an enqueued merge by its uuid while it runs, then once merged', async () => {
    const requests: Parameters<Fetch>[] = [];
    // As GitHub answered on nzymejs/githq-merge-sandbox (2026-11-02).
    const answers = [
        { status: 'pending', details: { message: 'Merge request is in progress.', uuid: 'b904' } },
        { status: 'merged', details: { message: 'Pull request was merged.', sha: '9bfa' } },
    ];
    const fetch: Fetch = (...request) => {
        requests.push(request);
        return Promise.resolve(Response.json(answers[requests.length - 1]));
    };
    const rest = createGitHubRestRequester({ getToken: () => 'gho_token', fetch });

    expect(await readAsyncMerge(rest, PARAMS)).toEqual({ status: 'pending', uuid: 'b904' });
    expect(await readAsyncMerge(rest, PARAMS)).toEqual({ status: 'merged', sha: '9bfa' });

    const [input, init] = requests[0] ?? [];
    expect(input).toBe('https://api.github.com/repos/nzymejs/githq-merge-sandbox/pulls/7/merge-async/b904');
    expect(init?.method).toBe('GET');
});

test('reads a merge that went into the merge queue', async () => {
    const fetch: Fetch = () => Promise.resolve(Response.json({ status: 'enqueued', details: {} }));
    const rest = createGitHubRestRequester({ getToken: () => 'gho_token', fetch });

    expect(await readAsyncMerge(rest, PARAMS)).toEqual({ status: 'enqueued' });
});
