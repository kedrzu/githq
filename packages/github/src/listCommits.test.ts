import type { Fetch } from '@nzyme/types/Fetch.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { expect, test } from 'bun:test';

import { createGitHubRequester } from './createGitHubRequester.js';
import { getSdk } from './generated.gen.js';
import { GitHubApiError } from './GitHubApiError.js';
import { listCommits } from './listCommits.js';

const PARAMS = { owner: 'kedrzu', name: 'githq', from: 'main', stopAt: new Set<string>(), maxPages: 3 };

test('stops at the first commit it is told to, across pages, without listing it, and keeps only the first lines', async () => {
    const { sdk, asked } = answeringPages([
        { next: 'cursor-1', commits: [{ oid: 'a', message: 'feat: a (#2)\n\nBody' }] },
        {
            commits: [
                { oid: 'b', message: 'fix: b' },
                { oid: 'tagged', message: 'chore: x' },
                { oid: 'old', message: 'y' },
            ],
        },
    ]);

    expect(await listCommits(sdk, { ...PARAMS, stopAt: new Set(['other', 'tagged']) })).toEqual({
        commits: [
            { subject: 'feat: a (#2)', author: null },
            { subject: 'fix: b', author: null },
        ],
        stoppedAt: 'tagged',
        limited: false,
    });
    expect(asked).toEqual([
        { owner: 'kedrzu', name: 'githq', from: 'main', after: null },
        { owner: 'kedrzu', name: 'githq', from: 'main', after: 'cursor-1' },
    ]);
});

test('with nothing to stop at, the cap ends the walk and says more is behind it', async () => {
    const page = { next: 'more', commits: [{ oid: 'a', message: 'feat: a' }] };
    const { sdk, asked } = answeringPages([page, page, page, page]);

    expect(await listCommits(sdk, PARAMS)).toEqual({
        commits: [
            { subject: 'feat: a', author: null },
            { subject: 'feat: a', author: null },
            { subject: 'feat: a', author: null },
        ],
        stoppedAt: null,
        limited: true,
    });
    expect(asked).toHaveLength(3);
});

test('the history running out is neither a stop nor limited', async () => {
    const { sdk } = answeringPages([{ commits: [{ oid: 'a', message: 'feat: a' }] }]);

    expect(await listCommits(sdk, PARAMS)).toEqual({
        commits: [{ subject: 'feat: a', author: null }],
        stoppedAt: null,
        limited: false,
    });
});

test('an author linked to a GitHub account is its login; one linked to none, or with no author at all, is null', async () => {
    const { sdk } = answeringPages([
        {
            commits: [
                { oid: 'a', message: 'feat: a', author: { user: { login: 'octocat' } } },
                { oid: 'b', message: 'fix: b', author: { user: null } },
                { oid: 'c', message: 'fix: c', author: null },
            ],
        },
    ]);

    const { commits } = await listCommits(sdk, PARAMS);

    expect(commits).toEqual([
        { subject: 'feat: a', author: 'octocat' },
        { subject: 'fix: b', author: null },
        { subject: 'fix: c', author: null },
    ]);
});

test('a commit GitHub does not have is a failure', async () => {
    const fetch: Fetch = () => Promise.resolve(Response.json({ data: { repository: { object: null } } }));
    const sdk = getSdk(createGitHubRequester({ getToken: () => 'token', fetch }));

    await expect(listCommits(sdk, PARAMS)).rejects.toBeInstanceOf(GitHubApiError);
});

function answeringPages(pages: readonly AnsweredPage[]) {
    const asked: unknown[] = [];
    const fetch: Fetch = (_, init) => {
        const body: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
        const page = pages[asked.length];
        asked.push(isPlainObject(body) ? body.variables : undefined);
        return Promise.resolve(
            Response.json({
                data: {
                    repository: {
                        object: {
                            history: {
                                pageInfo: { hasNextPage: page?.next !== undefined, endCursor: page?.next ?? null },
                                nodes: page?.commits ?? [],
                            },
                        },
                    },
                },
            }),
        );
    };

    return { asked, sdk: getSdk(createGitHubRequester({ getToken: () => 'token', fetch })) };
}

interface AnsweredPage {
    readonly next?: string;
    readonly commits: readonly { oid: string; message: string; author?: { user: { login: string } | null } | null }[];
}
