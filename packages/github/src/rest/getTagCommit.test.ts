import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { getTagCommit } from './getTagCommit.js';

test('answers the commit the tag stands on', async () => {
    const urls: unknown[] = [];
    const rest = createGitHubRestRequester({
        getToken: () => 'token',
        fetch: input => {
            urls.push(input);
            return Promise.resolve(Response.json({ sha: 'abc' }));
        },
    });

    expect(await getTagCommit(rest, 'kedrzu/githq', 'v0.2.0')).toBe('abc');
    expect(urls).toEqual(['https://api.github.com/repos/kedrzu/githq/commits/v0.2.0']);
});

test('a tag GitHub does not know has no commit; any other refusal is a failure', async () => {
    expect(await getTagCommit(answering(422), 'kedrzu/githq', 'v0.2.0')).toBeNull();
    expect(await getTagCommit(answering(404), 'kedrzu/githq', 'v0.2.0')).toBeNull();
    await expect(getTagCommit(answering(403), 'kedrzu/githq', 'v0.2.0')).rejects.toBeInstanceOf(GitHubApiError);
});

function answering(status: number) {
    return createGitHubRestRequester({
        getToken: () => 'token',
        fetch: () => Promise.resolve(Response.json({ message: 'No' }, { status })),
    });
}
