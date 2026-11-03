import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { listRepositoryTags } from './listRepositoryTags.js';
import type { ListRepositoryTagsResult } from './listRepositoryTags.js';

test('asks every tag with the held ETag and reports 304 while none changed', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering(new Response(null, { status: 304, headers: { etag: '"abc"' } }), requests);

    expect(await listRepositoryTags(rest, { nameWithOwner: 'kedrzu/githq', etag: '"abc"' })).toEqual({ status: 304 });
    const [input, init] = requests[0] ?? [];
    expect(input).toBe('https://api.github.com/repos/kedrzu/githq/git/matching-refs/tags');
    expect(new Headers(init?.headers).get('If-None-Match')).toBe('"abc"');
});

test('returns the tags’ names, a name with a slash whole, and the new ETag', async () => {
    const rest = restAnswering(
        Response.json(
            [
                {
                    ref: 'refs/tags/v0.1.0-rc.1',
                    node_id: 'REF_1',
                    url: 'https://api.github.com/repos/kedrzu/githq/git/refs/tags/v0.1.0-rc.1',
                    object: { sha: 'abc', type: 'commit', url: 'https://api.github.com/x' },
                },
                { ref: 'refs/tags/release/1.2', node_id: 'REF_2', object: { sha: 'def', type: 'tag' } },
            ],
            { headers: { etag: '"def"' } },
        ),
    );

    const expected: ListRepositoryTagsResult = { status: 200, etag: '"def"', tags: ['v0.1.0-rc.1', 'release/1.2'] };
    expect(await listRepositoryTags(rest, { nameWithOwner: 'kedrzu/githq' })).toEqual(expected);
});

test('an empty repository, which GitHub answers 409, has no tags', async () => {
    const rest = restAnswering(Response.json({ message: 'Git Repository is empty.' }, { status: 409 }));

    const expected: ListRepositoryTagsResult = { status: 200, etag: undefined, tags: [] };
    expect(await listRepositoryTags(rest, { nameWithOwner: 'kedrzu/empty' })).toEqual(expected);
});

test('throws when GitHub refuses or the answer is not a list of tags', async () => {
    await expect(
        listRepositoryTags(restAnswering(Response.json({ message: 'Not Found' }, { status: 404 })), {
            nameWithOwner: 'kedrzu/githq',
        }),
    ).rejects.toBeInstanceOf(GitHubApiError);
    await expect(
        listRepositoryTags(restAnswering(Response.json([{ ref: 'refs/heads/main' }])), {
            nameWithOwner: 'kedrzu/githq',
        }),
    ).rejects.toBeInstanceOf(GitHubApiError);
});

function restAnswering(response: Response, requests: Parameters<Fetch>[] = []) {
    const fetch: Fetch = (...request) => {
        requests.push(request);
        return Promise.resolve(response);
    };

    return createGitHubRestRequester({ getToken: () => 'gho_token', fetch });
}
