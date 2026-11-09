import { expect, test } from 'bun:test';

import type { GitHubRestRequest } from './createGitHubRestRequester.js';
import { renderMarkdown } from './renderMarkdown.js';

test("sends the text as gfm in the repository's context and gives back GitHub's HTML as sent", async () => {
    const requests: GitHubRestRequest[] = [];
    const html = '<p>Fixed in <a href="https://github.com/acme/web/issues/42">#42</a></p>';

    const rendered = await renderMarkdown(
        request => {
            requests.push(request);
            return Promise.resolve({
                status: 200,
                payload: undefined,
                text: html,
                headers: new Headers({ 'Content-Type': 'text/html' }),
                retryAfter: undefined,
            });
        },
        { text: 'Fixed in #42', context: 'acme/web' },
    );

    expect(rendered).toBe(html);
    expect(requests).toEqual([
        { method: 'POST', url: '/markdown', body: { text: 'Fixed in #42', mode: 'gfm', context: 'acme/web' } },
    ]);
});
