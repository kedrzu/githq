import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { listCommitSubjects } from './listCommitSubjects.js';

const PARAMS = { nameWithOwner: 'kedrzu/githq', from: 'abc', until: null, maxPages: 3 };

test('reads back from the commit asked for and stops before the end it is given, however many pages are left', async () => {
    const { rest, urls } = requester([
        page(['fix: one\n\nThe body', 'feat: two (#2)', 'the last release', 'feat: older'], { more: true }),
        page(['feat: never read']),
    ]);

    expect(await listCommitSubjects(rest, { ...PARAMS, until: 'sha-2' })).toEqual({
        subjects: ['fix: one', 'feat: two (#2)'],
        limited: false,
    });
    expect(urls).toEqual(['https://api.github.com/repos/kedrzu/githq/commits?sha=abc&per_page=100']);
});

test('with no end it stops after the pages allowed and says more were left', async () => {
    const { rest, urls } = requester([
        page(['feat: a'], { more: true }),
        page(['feat: b'], { more: true }),
        page(['feat: c'], { more: true }),
        page(['feat: never read']),
    ]);

    expect(await listCommitSubjects(rest, PARAMS)).toEqual({
        subjects: ['feat: a', 'feat: b', 'feat: c'],
        limited: true,
    });
    expect(urls).toHaveLength(3);
});

test('a history that ends within the pages allowed is whole', async () => {
    const { rest } = requester([page(['feat: a'])]);

    expect(await listCommitSubjects(rest, PARAMS)).toEqual({ subjects: ['feat: a'], limited: false });
});

test('throws when GitHub refuses or the answer is not a list of commits', async () => {
    const refused = requester([Response.json({ message: 'Not Found' }, { status: 404 })]);
    await expect(listCommitSubjects(refused.rest, PARAMS)).rejects.toBeInstanceOf(GitHubApiError);

    const malformed = requester([Response.json([{ sha: 'a' }])]);
    await expect(listCommitSubjects(malformed.rest, PARAMS)).rejects.toBeInstanceOf(GitHubApiError);
});

function requester(answers: Response[]) {
    const urls: Parameters<Fetch>[0][] = [];
    const rest = createGitHubRestRequester({
        getToken: () => 'token',
        fetch: input => {
            urls.push(input);
            return Promise.resolve(answers.shift() ?? new Response(null, { status: 500 }));
        },
    });
    return { rest, urls };
}

/** A page of commits with those messages, `sha-<index>` each. */
function page(messages: readonly string[], { more = false }: { more?: boolean } = {}) {
    return Response.json(
        messages.map((message, index) => ({ sha: `sha-${index}`, commit: { message } })),
        more ? { headers: { link: '<https://api.github.com/repositories/1/commits?page=2>; rel="next"' } } : undefined,
    );
}
