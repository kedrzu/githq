import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { getGitBlobText } from './getGitBlobText.js';

test('decodes the wrapped base64 as UTF-8, not one character per byte', async () => {
    const text = 'zażółć gęślą jaźń 🦊\n';
    const base64 = Buffer.from(text).toString('base64');
    const wrapped = `${base64.slice(0, 20)}\n${base64.slice(20)}\n`;
    const requests: Parameters<Fetch>[] = [];
    const rest = createGitHubRestRequester({
        getToken: () => 'gho_token',
        fetch: (...request) => {
            requests.push(request);
            return Promise.resolve(Response.json({ sha: 'abc', encoding: 'base64', content: wrapped }));
        },
    });

    expect(await getGitBlobText(rest, { nameWithOwner: 'kedrzu/githq', oid: 'abc' })).toBe(text);
    expect(requests[0]?.[0]).toBe('https://api.github.com/repos/kedrzu/githq/git/blobs/abc');
});
