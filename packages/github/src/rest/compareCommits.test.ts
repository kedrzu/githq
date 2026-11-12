import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import { compareCommits } from './compareCommits.js';
import type { CommitComparison } from './compareCommits.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';

const PARAMS = { nameWithOwner: 'kedrzu/nzyme', base: 'old1', head: 'new1' };

test('asks for the first page of base...head and reads its commits and files', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = answering(requests, {
        status: 'ahead',
        ahead_by: 3,
        behind_by: 0,
        total_commits: 3,
        commits: [
            {
                sha: 'c1',
                commit: { message: 'feat: a (#2)\n\nBody', author: { name: 'Ann' } },
                author: { login: 'ann' },
            },
            { sha: 'c2', commit: { message: 'fix: b', author: { name: 'Bob Git' } }, author: null },
            { sha: 'c3', commit: { message: 'chore: c', author: null }, author: null },
        ],
        files: [
            { filename: 'src/new.ts', previous_filename: 'src/old.ts', status: 'renamed', additions: 1, deletions: 2 },
            { filename: 'src/a.ts', status: 'modified', additions: 4, deletions: 0, patch: '@@ -1 +1 @@\n-a\n+b' },
        ],
    });

    const expected: CommitComparison = {
        status: 'ahead',
        aheadBy: 3,
        behindBy: 0,
        totalCommits: 3,
        commits: [
            { oid: 'c1', subject: 'feat: a (#2)', author: 'ann' },
            { oid: 'c2', subject: 'fix: b', author: 'Bob Git' },
            { oid: 'c3', subject: 'chore: c', author: null },
        ],
        files: [
            { path: 'src/new.ts', previousPath: 'src/old.ts', status: 'renamed', additions: 1, deletions: 2 },
            { path: 'src/a.ts', previousPath: null, status: 'modified', additions: 4, deletions: 0 },
        ],
    };
    expect(await compareCommits(rest, PARAMS)).toEqual(expected);
    expect(requests.map(([url]) => url)).toEqual(['https://api.github.com/repos/kedrzu/nzyme/compare/old1...new1']);
});

test('a malformed answer is a GitHub error', async () => {
    const valid = { status: 'behind', ahead_by: 0, behind_by: 2, total_commits: 0, commits: [], files: [] };
    const answers = [
        [],
        { ...valid, status: 'sideways' },
        { ...valid, ahead_by: '0' },
        { ...valid, commits: null },
        { ...valid, commits: [{ sha: 'c1', commit: null }] },
        { ...valid, files: [{ filename: 'a.ts', status: 'added', additions: 1 }] },
    ];
    for (const answer of answers) {
        await expect(compareCommits(answering([], answer), PARAMS)).rejects.toBeInstanceOf(GitHubApiError);
    }
});

function answering(requests: Parameters<Fetch>[], answer: unknown) {
    return createGitHubRestRequester({
        getToken: () => 'gho_token',
        fetch: (...request) => {
            requests.push(request);
            return Promise.resolve(Response.json(answer));
        },
    });
}
