import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { getMergeBase } from './getMergeBase.js';

const PARAMS = { nameWithOwner: 'kedrzu/githq', baseOid: 'base1', headOid: 'head1' };

test('asks for page 2 of one, which carries no files, and reads the merge base', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = createGitHubRestRequester({
        getToken: () => 'gho_token',
        fetch: (...request) => {
            requests.push(request);
            return Promise.resolve(Response.json({ merge_base_commit: { sha: 'fork-point' }, commits: [] }));
        },
    });

    expect(await getMergeBase(rest, PARAMS)).toBe('fork-point');
    expect(requests[0]?.[0]).toBe('https://api.github.com/repos/kedrzu/githq/compare/base1...head1?per_page=1&page=2');
});

test('an answer without a merge base is an error, never a guess', async () => {
    const rest = createGitHubRestRequester({
        getToken: () => 'gho_token',
        fetch: () => Promise.resolve(Response.json({ commits: [] })),
    });

    await expect(getMergeBase(rest, PARAMS)).rejects.toBeInstanceOf(GitHubApiError);
});
