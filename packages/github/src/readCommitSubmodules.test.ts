import type { Fetch } from '@nzyme/types/Fetch.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { expect, test } from 'bun:test';

import { createGitHubRequester } from './createGitHubRequester.js';
import { getSdk } from './generated.gen.js';
import { GitHubApiError } from './GitHubApiError.js';
import { readCommitSubmodules } from './readCommitSubmodules.js';
import type { CommitSubmodule } from './readCommitSubmodules.js';

const PARAMS = { nameWithOwner: 'kedrzu/githq', oid: 'c1' };

test('reads the submodules of the commit asked for', async () => {
    const asked: unknown[] = [];
    const sdk = answering(asked, {
        repository: {
            object: {
                submodules: {
                    nodes: [{ path: 'nzyme', gitUrl: 'https://github.com/kedrzu/nzyme.git' }, null],
                },
            },
        },
    });

    const expected: CommitSubmodule[] = [{ path: 'nzyme', gitUrl: 'https://github.com/kedrzu/nzyme.git' }];
    expect(await readCommitSubmodules(sdk, PARAMS)).toEqual(expected);
    expect(asked).toEqual([{ owner: 'kedrzu', name: 'githq', oid: 'c1' }]);
});

test('a commit or repository GitHub does not have is a failure', async () => {
    for (const data of [{ repository: { object: null } }, { repository: null }]) {
        await expect(readCommitSubmodules(answering([], data), PARAMS)).rejects.toMatchObject({ status: 404 });
        await expect(readCommitSubmodules(answering([], data), PARAMS)).rejects.toBeInstanceOf(GitHubApiError);
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
