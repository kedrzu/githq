import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { listReleases } from './listReleases.js';

const NEXT = 'https://api.github.com/repositories/1/releases?per_page=100&page=2';

test('asks for rendered HTML, follows every page and keeps only what is published and stable', async () => {
    const requests: Parameters<Fetch>[] = [];
    const answers = [
        Response.json(
            [
                release({ tag_name: 'v0.2.0', body_html: '<p>Two</p>' }),
                release({ tag_name: 'development', prerelease: true }),
                release({ tag_name: 'v0.3.0', draft: true, published_at: null }),
            ],
            { headers: { link: `<${NEXT}>; rel="next"` } },
        ),
        Response.json([release({ tag_name: 'v0.1.0', body_html: null })]),
    ];
    const rest = createGitHubRestRequester({
        getToken: () => 'token',
        fetch: (...args) => {
            requests.push(args);
            return Promise.resolve(answers.shift() ?? new Response(null, { status: 500 }));
        },
    });

    expect(await listReleases(rest, 'kedrzu/githq')).toEqual([
        { tagName: 'v0.2.0', publishedAt: '2026-11-03T10:00:00Z', bodyHtml: '<p>Two</p>' },
        { tagName: 'v0.1.0', publishedAt: '2026-11-03T10:00:00Z', bodyHtml: '' },
    ]);
    expect(requests.map(([input]) => input)).toEqual([
        'https://api.github.com/repos/kedrzu/githq/releases?per_page=100',
        NEXT,
    ]);
    const [, init] = requests[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.get('Accept')).toBe('application/vnd.github.html+json');
    expect(headers.get('Authorization')).toBe('Bearer token');
});

test('throws when GitHub refuses, a rate limit among it, or the answer is not a list of releases', async () => {
    for (const answer of [
        Response.json({ message: 'API rate limit exceeded' }, { status: 403 }),
        Response.json({ message: 'odd' }),
        Response.json([{ id: 1 }]),
    ]) {
        const rest = createGitHubRestRequester({
            getToken: () => 'token',
            fetch: () => Promise.resolve(answer),
        });
        // eslint-disable-next-line no-await-in-loop -- one after the other, each with its own answer
        await expect(listReleases(rest, 'kedrzu/githq')).rejects.toBeInstanceOf(GitHubApiError);
    }
});

function release(fields: Readonly<Record<string, unknown>>) {
    return { draft: false, prerelease: false, published_at: '2026-11-03T10:00:00Z', ...fields };
}
