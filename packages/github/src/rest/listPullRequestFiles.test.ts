import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { listPullRequestFiles } from './listPullRequestFiles.js';

const NEXT_URL = 'https://api.github.com/repositories/1/pulls/7/files?per_page=100&page=2';

test('reads every page: where renamed and copied files came from, their status, size and patch layout', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = createRest(requests, [
        Response.json(
            [
                {
                    filename: 'new.ts',
                    previous_filename: 'old.ts',
                    status: 'renamed',
                    additions: 1,
                    deletions: 1,
                    patch: '@@ -1 +1 @@\n-a\n+b',
                },
                { filename: 'image.png', status: 'added', additions: 0, deletions: 0 },
            ],
            { headers: { link: `<${NEXT_URL}>; rel="next"` } },
        ),
        Response.json([
            { filename: 'copy.ts', previous_filename: 'source.ts', status: 'copied', additions: 0, deletions: 0 },
            { filename: 'gone.ts', status: 'removed', additions: 0, deletions: 2, patch: '@@ -1,2 +0,0 @@\n-a\n-b' },
        ]),
    ]);

    const files = await listPullRequestFiles(rest, { nameWithOwner: 'kedrzu/githq', number: 7 });

    expect(files).toEqual([
        {
            path: 'new.ts',
            previousPath: 'old.ts',
            status: 'RENAMED',
            additions: 1,
            deletions: 1,
            layout: { hunks: [{ beforeStart: 1, afterStart: 1, lines: '-+' }] },
        },
        { path: 'image.png', previousPath: null, status: 'ADDED', additions: 0, deletions: 0, layout: null },
        { path: 'copy.ts', previousPath: 'source.ts', status: 'COPIED', additions: 0, deletions: 0, layout: null },
        {
            path: 'gone.ts',
            previousPath: null,
            status: 'DELETED',
            additions: 0,
            deletions: 2,
            layout: { hunks: [{ beforeStart: 1, afterStart: 0, lines: '--' }] },
        },
    ]);
    expect(requests.map(([url]) => url)).toEqual([
        'https://api.github.com/repos/kedrzu/githq/pulls/7/files?per_page=100',
        NEXT_URL,
    ]);
});

test('a page that is not a list of files is malformed', async () => {
    const answers = [
        Response.json({ message: 'not a list' }),
        Response.json([{ filename: 'a.ts', status: 'renamed', additions: '1', deletions: 0 }]),
        Response.json([{ status: 'modified', additions: 0, deletions: 0 }]),
    ];
    for (const answer of answers) {
        const rest = createRest([], [answer]);

        await expect(listPullRequestFiles(rest, { nameWithOwner: 'kedrzu/githq', number: 7 })).rejects.toBeInstanceOf(
            GitHubApiError,
        );
    }
});

test('a status GitHub added since is null, and the file is still read', async () => {
    const rest = createRest(
        [],
        [
            Response.json([
                {
                    filename: 'a.ts',
                    previous_filename: 'b.ts',
                    status: 'teleported',
                    additions: 1,
                    deletions: 0,
                    patch: '@@ -0,0 +1 @@\n+a',
                },
            ]),
        ],
    );

    const files = await listPullRequestFiles(rest, { nameWithOwner: 'kedrzu/githq', number: 7 });

    expect(files).toEqual([
        {
            path: 'a.ts',
            previousPath: 'b.ts',
            status: null,
            additions: 1,
            deletions: 0,
            layout: { hunks: [{ beforeStart: 0, afterStart: 1, lines: '+' }] },
        },
    ]);
});

function createRest(requests: Parameters<Fetch>[], answers: Response[]) {
    return createGitHubRestRequester({
        getToken: () => 'gho_token',
        fetch: (...request) => {
            requests.push(request);
            const answer = answers.shift();
            return answer ? Promise.resolve(answer) : Promise.reject(new Error('Asked too often'));
        },
    });
}
