import type { Fetch } from '@nzyme/types/Fetch.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { expect, test } from 'bun:test';

import { createGitHubRequester } from './createGitHubRequester.js';
import { getSdk } from './generated.gen.js';
import { GitHubApiError } from './GitHubApiError.js';
import { listReleases } from './listReleases.js';

const REPOSITORY = { owner: 'kedrzu', name: 'githq' };
const STABLE = {
    tagName: 'v0.2.0',
    isDraft: false,
    isPrerelease: false,
    publishedAt: '2026-11-03T10:00:00Z',
    descriptionHTML: '<p>Changes</p>',
    tagCommit: { oid: 'abc' },
};

test('reads every page and keeps only what is published and stable, with its rendered text and commit', async () => {
    const asked: unknown[] = [];
    const pages = [
        {
            pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
            nodes: [STABLE, { ...STABLE, tagName: 'draft', isDraft: true }],
        },
        {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [
                { ...STABLE, tagName: 'development', isPrerelease: true },
                { ...STABLE, tagName: 'unpublished', publishedAt: null },
                { ...STABLE, tagName: 'v0.1.0', descriptionHTML: null, tagCommit: null },
            ],
        },
    ];

    const releases = await listReleases(
        sdkAnswering(variables => {
            asked.push(isPlainObject(variables) ? variables.after : undefined);
            return { repository: { releases: pages[asked.length - 1] } };
        }),
        REPOSITORY,
    );

    expect(releases).toEqual([
        { tagName: 'v0.2.0', publishedAt: STABLE.publishedAt, bodyHtml: '<p>Changes</p>', tagCommit: 'abc' },
        { tagName: 'v0.1.0', publishedAt: STABLE.publishedAt, bodyHtml: '', tagCommit: null },
    ]);
    expect(asked).toEqual([null, 'cursor-1']);
});

test('a repository GitHub does not have is a failure', async () => {
    await expect(
        listReleases(
            sdkAnswering(() => ({ repository: null })),
            REPOSITORY,
        ),
    ).rejects.toBeInstanceOf(GitHubApiError);
});

function sdkAnswering(answer: (variables: unknown) => unknown) {
    const fetch: Fetch = (_, init) => {
        const body: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
        return Promise.resolve(Response.json({ data: answer(isPlainObject(body) ? body.variables : undefined) }));
    };

    return getSdk(createGitHubRequester({ getToken: () => 'token', fetch }));
}
