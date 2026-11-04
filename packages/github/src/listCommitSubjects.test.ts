import type { Fetch } from '@nzyme/types/Fetch.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { expect, test } from 'bun:test';

import { createGitHubRequester } from './createGitHubRequester.js';
import { getSdk } from './generated.gen.js';
import { GitHubApiError } from './GitHubApiError.js';
import { listCommitSubjects } from './listCommitSubjects.js';

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

    expect(await listCommitSubjects(sdk, { ...PARAMS, stopAt: new Set(['other', 'tagged']) })).toEqual({
        subjects: ['feat: a (#2)', 'fix: b'],
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

    expect(await listCommitSubjects(sdk, PARAMS)).toEqual({
        subjects: ['feat: a', 'feat: a', 'feat: a'],
        stoppedAt: null,
        limited: true,
    });
    expect(asked).toHaveLength(3);
});

test('the history running out is neither a stop nor limited', async () => {
    const { sdk } = answeringPages([{ commits: [{ oid: 'a', message: 'feat: a' }] }]);

    expect(await listCommitSubjects(sdk, PARAMS)).toEqual({ subjects: ['feat: a'], stoppedAt: null, limited: false });
});

test('a commit GitHub does not have is a failure', async () => {
    const fetch: Fetch = () => Promise.resolve(Response.json({ data: { repository: { object: null } } }));
    const sdk = getSdk(createGitHubRequester({ getToken: () => 'token', fetch }));

    await expect(listCommitSubjects(sdk, PARAMS)).rejects.toBeInstanceOf(GitHubApiError);
});

function answeringPages(pages: readonly { next?: string; commits: readonly { oid: string; message: string }[] }[]) {
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
