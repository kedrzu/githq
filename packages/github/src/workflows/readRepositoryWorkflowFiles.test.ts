import type { Fetch } from '@nzyme/types/Fetch.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { expect, test } from 'bun:test';

import { createGitHubRequester } from '../createGitHubRequester.js';
import { getSdk } from '../generated.gen.js';
import { GitHubApiError } from '../GitHubApiError.js';
import type { GitHubWorkflowFileParse } from './parseWorkflowFile.js';
import { readRepositoryWorkflowFiles } from './readRepositoryWorkflowFiles.js';

test('reads and parses the workflow files at the ref asked, by path, leaving out what is not one', async () => {
    const asked: unknown[] = [];
    const sdk = answering(asked, {
        repository: {
            object: {
                entries: [
                    {
                        path: '.github/workflows/release.yml',
                        object: { text: 'on: workflow_dispatch', isTruncated: false },
                    },
                    { path: '.github/workflows/lint.yaml', object: { text: 'name: Lint', isTruncated: false } },
                    { path: '.github/workflows/README.md', object: { text: '# Workflows', isTruncated: false } },
                    { path: '.github/workflows/huge.yml', object: { text: 'on: pu', isTruncated: true } },
                    { path: '.github/workflows/shared', object: {} },
                ],
            },
        },
    });

    const expected = new Map<string, GitHubWorkflowFileParse>([
        [
            '.github/workflows/release.yml',
            {
                kind: 'parsed',
                file: { triggers: [{ event: 'workflow_dispatch' }], dispatch: { inputs: [] }, callOnly: false },
            },
        ],
        ['.github/workflows/lint.yaml', { kind: 'noTriggers' }],
    ]);
    expect(await readRepositoryWorkflowFiles(sdk, { nameWithOwner: 'kedrzu/githq', ref: 'v1.0.0' })).toEqual(expected);
    expect(asked).toEqual([{ owner: 'kedrzu', name: 'githq', expression: 'v1.0.0:.github/workflows' }]);
});

test('reads the default branch when no ref is named, and none when it has no workflows', async () => {
    const asked: unknown[] = [];

    expect(
        await readRepositoryWorkflowFiles(answering(asked, { repository: { object: null } }), {
            nameWithOwner: 'kedrzu/githq',
        }),
    ).toEqual(new Map());
    expect(asked).toEqual([{ owner: 'kedrzu', name: 'githq', expression: 'HEAD:.github/workflows' }]);
});

test('a repository GitHub does not have is a failure', async () => {
    const read = readRepositoryWorkflowFiles(answering([], { repository: null }), { nameWithOwner: 'kedrzu/githq' });

    await expect(read).rejects.toBeInstanceOf(GitHubApiError);
});

function answering(asked: unknown[], data: unknown) {
    const fetch: Fetch = (_, init) => {
        const body: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
        asked.push(isPlainObject(body) ? body.variables : undefined);
        return Promise.resolve(Response.json({ data }));
    };

    return getSdk(createGitHubRequester({ getToken: () => 'token', fetch }));
}
