import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { readWorkflowFile } from './readWorkflowFile.js';
import type { ReadWorkflowFileResult } from './readWorkflowFile.js';

const PARAMS = { nameWithOwner: 'kedrzu/githq', path: '.github/workflows/deploy.yml' };

/** A file as the contents API answers it: base64 broken into lines, with fields githq does not read. */
function fileAnswer(text: string, headers: Record<string, string> = {}) {
    const content = btoa(text).replaceAll(/(.{60})/g, '$1\n');
    return Response.json(
        { type: 'file', encoding: 'base64', size: text.length, name: 'deploy.yml', path: PARAMS.path, content },
        { headers },
    );
}

test('reads the file at the ref asked, with the held ETag, and parses it', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering(
        [fileAnswer('name: Deploy\non:\n  push:\n    branches: [main]\n', { etag: '"new"' })],
        requests,
    );

    const expected: ReadWorkflowFileResult = {
        status: 200,
        etag: '"new"',
        workflow: {
            kind: 'parsed',
            file: { triggers: [{ event: 'push', branches: ['main'] }], dispatch: null, callOnly: false },
        },
    };
    expect(await readWorkflowFile(rest, { ...PARAMS, ref: 'release/1.0', etag: '"old"' })).toEqual(expected);
    const [input, init] = requests[0] ?? [];
    expect(input).toBe(
        'https://api.github.com/repos/kedrzu/githq/contents/.github/workflows/deploy.yml?ref=release%2F1.0',
    );
    expect(new Headers(init?.headers).get('If-None-Match')).toBe('"old"');
});

test('reports 304 while the file did not change', async () => {
    const rest = restAnswering([new Response(null, { status: 304 })]);

    expect(await readWorkflowFile(rest, { ...PARAMS, etag: '"abc"' })).toEqual({ status: 304 });
});

test.each([
    ['no file at that ref', Response.json({ message: 'Not Found' }, { status: 404 })],
    ['a directory at that path', Response.json([{ type: 'file', name: 'deploy.yml' }])],
])('reads %s as missing', async (_, response) => {
    const rest = restAnswering([response]);

    expect(await readWorkflowFile(rest, PARAMS)).toEqual({
        status: 200,
        etag: undefined,
        workflow: { kind: 'missing' },
    });
});

test('a file that is not YAML answers why, without throwing', async () => {
    const rest = restAnswering([fileAnswer('on: [push\n')]);

    expect(await readWorkflowFile(rest, PARAMS)).toMatchObject({ workflow: { kind: 'notYaml' } });
});

test.each([
    ['refused', Response.json({ message: 'Forbidden' }, { status: 403 })],
    ['too large to hold content', Response.json({ type: 'file', encoding: 'none', content: '' })],
])('throws on an answer that is %s', async (_, response) => {
    const rest = restAnswering([response]);

    await expect(readWorkflowFile(rest, PARAMS)).rejects.toBeInstanceOf(GitHubApiError);
});

function restAnswering(responses: Response[], requests: Parameters<Fetch>[] = []) {
    const queue = [...responses];
    const fetch: Fetch = (...request) => {
        requests.push(request);
        const response = queue.shift();
        return response ? Promise.resolve(response) : Promise.reject(new Error('No more answers'));
    };

    return createGitHubRestRequester({ getToken: () => 'gho_token', fetch });
}
