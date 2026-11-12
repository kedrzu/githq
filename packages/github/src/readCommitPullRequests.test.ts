import type { Fetch } from '@nzyme/types/Fetch.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { expect, test } from 'bun:test';

import { createGitHubRequester } from './createGitHubRequester.js';
import { getSdk } from './generated.gen.js';
import { GitHubApiError } from './GitHubApiError.js';
import { readCommitPullRequests } from './readCommitPullRequests.js';
import type { CommitPullRequest } from './readCommitPullRequests.js';

const PARAMS = { nameWithOwner: 'kedrzu/nzyme', oid: 'c1' };

test('reads the pull requests that carry the commit asked for', async () => {
    const asked: unknown[] = [];
    const open: CommitPullRequest = {
        number: 7,
        state: 'OPEN',
        title: 'feat: a',
        url: 'https://github.com/kedrzu/nzyme/pull/7',
        isDraft: true,
    };
    const sdk = answering(asked, { repository: { object: { associatedPullRequests: { nodes: [open, null] } } } });

    expect(await readCommitPullRequests(sdk, PARAMS)).toEqual([open]);
    expect(asked).toEqual([{ owner: 'kedrzu', name: 'nzyme', oid: 'c1' }]);
});

test('a commit or repository GitHub does not have is a failure', async () => {
    for (const data of [{ repository: { object: null } }, { repository: null }]) {
        await expect(readCommitPullRequests(answering([], data), PARAMS)).rejects.toMatchObject({ status: 404 });
        await expect(readCommitPullRequests(answering([], data), PARAMS)).rejects.toBeInstanceOf(GitHubApiError);
    }
});

function answering(asked: unknown[], data: unknown) {
    const fetch: Fetch = (_, init) => {
        const body: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
        asked.push(isPlainObject(body) ? body.variables : undefined);
        return Promise.resolve(Response.json({ data }));
    };

    return getSdk(createGitHubRequester({ getToken: () => 'token', fetch }));
}
