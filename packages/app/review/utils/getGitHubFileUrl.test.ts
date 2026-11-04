import { expect, test } from 'bun:test';

import { getGitHubFileUrl } from './getGitHubFileUrl.js';

test("a file's address on GitHub's changed files page is the page and the SHA-256 of its path, UTF-8 and all", async () => {
    const page = 'https://github.com/acme/web/pull/7/files';

    expect(await getGitHubFileUrl(page, 'README.md')).toBe(
        `${page}#diff-${new Bun.CryptoHasher('sha256').update('README.md').digest('hex')}`,
    );
    expect(await getGitHubFileUrl(page, 'docs/zażółć.md')).toBe(
        `${page}#diff-${new Bun.CryptoHasher('sha256').update('docs/zażółć.md').digest('hex')}`,
    );
});
