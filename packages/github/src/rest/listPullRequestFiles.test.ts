import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { listPullRequestFiles } from './listPullRequestFiles.js';
import type { PullRequestFilesPage } from './listPullRequestFiles.js';

const NEXT_URL = 'https://api.github.com/repositories/1/pulls/7/files?per_page=100&page=2';
const LAST_URL = 'https://api.github.com/repositories/1/pulls/7/files?per_page=100&page=2';
const OLD_POINTER = 'a3eadfaf9fff361ddb426fc8e7b0674553cbd06b';
const NEW_POINTER = '7e8461f875e0be7b57c8a2d2c6afa05ff4cc47ef';

test('reads every page: where renamed and copied files came from, their size, patch layout and submodule pointers', async () => {
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
            { headers: { link: `<${NEXT_URL}>; rel="next", <${LAST_URL}>; rel="last"` } },
        ),
        Response.json([
            { filename: 'copy.ts', previous_filename: 'source.ts', status: 'copied', additions: 0, deletions: 0 },
            { filename: 'gone.ts', status: 'removed', additions: 0, deletions: 2, patch: '@@ -1,2 +0,0 @@\n-a\n-b' },
            {
                filename: 'nzyme',
                status: 'modified',
                additions: 1,
                deletions: 1,
                patch: `@@ -1 +1 @@\n-Subproject commit ${OLD_POINTER}\n+Subproject commit ${NEW_POINTER}`,
            },
        ]),
    ]);
    const pages: PullRequestFilesPage[] = [];

    await listPullRequestFiles(rest, { nameWithOwner: 'kedrzu/githq', number: 7, onPage: page => pages.push(page) });

    const expected: PullRequestFilesPage[] = [
        {
            files: [
                {
                    path: 'new.ts',
                    previousPath: 'old.ts',
                    additions: 1,
                    deletions: 1,
                    layout: { hunks: [{ beforeStart: 1, afterStart: 1, lines: '-+' }] },
                    submodule: null,
                },
                { path: 'image.png', previousPath: null, additions: 0, deletions: 0, layout: null, submodule: null },
            ],
            number: 1,
            pages: 2,
        },
        {
            files: [
                {
                    path: 'copy.ts',
                    previousPath: 'source.ts',
                    additions: 0,
                    deletions: 0,
                    layout: null,
                    submodule: null,
                },
                {
                    path: 'gone.ts',
                    previousPath: null,
                    additions: 0,
                    deletions: 2,
                    layout: { hunks: [{ beforeStart: 1, afterStart: 0, lines: '--' }] },
                    submodule: null,
                },
                {
                    path: 'nzyme',
                    previousPath: null,
                    additions: 1,
                    deletions: 1,
                    layout: { hunks: [{ beforeStart: 1, afterStart: 1, lines: '-+' }] },
                    submodule: { before: OLD_POINTER, after: NEW_POINTER },
                },
            ],
            number: 2,
            pages: 2,
        },
    ];
    expect(pages).toEqual(expected);
    expect(requests.map(([url]) => url)).toEqual([
        'https://api.github.com/repos/kedrzu/githq/pulls/7/files?per_page=100',
        NEXT_URL,
    ]);
});

test('tells of each page as it arrives, before asking for the next; throwing there stops the read', async () => {
    const requests: Parameters<Fetch>[] = [];
    const pages = () => [
        Response.json([{ filename: 'a.ts', status: 'added', additions: 1, deletions: 0, patch: '@@ -0,0 +1 @@\n+a' }], {
            headers: { link: `<${NEXT_URL}>; rel="next"` },
        }),
        Response.json([
            { filename: 'b.ts', status: 'removed', additions: 0, deletions: 1, patch: '@@ -1 +0,0 @@\n-b' },
        ]),
    ];
    const told: { readonly paths: string[]; readonly asked: number; readonly pages: number | null }[] = [];

    await listPullRequestFiles(createRest(requests, pages()), {
        nameWithOwner: 'kedrzu/githq',
        number: 7,
        onPage: page =>
            told.push({ paths: page.files.map(file => file.path), asked: requests.length, pages: page.pages }),
    });

    // No last page named: not known until the last one.
    expect(told).toEqual([
        { paths: ['a.ts'], asked: 1, pages: null },
        { paths: ['b.ts'], asked: 2, pages: 2 },
    ]);

    const stopped: Parameters<Fetch>[] = [];
    await expect(
        listPullRequestFiles(createRest(stopped, pages()), {
            nameWithOwner: 'kedrzu/githq',
            number: 7,
            onPage: () => {
                throw new Error('Nobody waits');
            },
        }),
    ).rejects.toThrow('Nobody waits');
    expect(stopped).toHaveLength(1);
});

test('a page that is not a list of files is malformed', async () => {
    const answers = [
        Response.json({ message: 'not a list' }),
        Response.json([{ filename: 'a.ts', status: 'renamed', additions: '1', deletions: 0 }]),
        Response.json([{ status: 'modified', additions: 0, deletions: 0 }]),
    ];
    for (const answer of answers) {
        const rest = createRest([], [answer]);

        await expect(
            listPullRequestFiles(rest, { nameWithOwner: 'kedrzu/githq', number: 7, onPage: () => {} }),
        ).rejects.toBeInstanceOf(GitHubApiError);
    }
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
