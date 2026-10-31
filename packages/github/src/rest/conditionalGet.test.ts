import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { conditionalGet } from './conditionalGet.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';

const PROJECT_URL = '/users/kedrzu/projectsV2/1';

test('sends the held ETag and answers 304 while nothing changed', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering(new Response(null, { status: 304, headers: { etag: 'W/"abc"' } }), requests);

    expect(await conditionalGet(rest, { url: PROJECT_URL, etag: 'W/"abc"' })).toEqual({ status: 304 });

    const [input, init] = requests[0] ?? [];
    expect(input).toBe('https://api.github.com/users/kedrzu/projectsV2/1');
    expect(new Headers(init?.headers).get('If-None-Match')).toBe('W/"abc"');
});

test('returns the new ETag and the body once the resource changed', async () => {
    const rest = restAnswering(Response.json({ id: 1, title: 'Roadmap' }, { headers: { etag: 'W/"def"' } }));

    expect(await conditionalGet(rest, { url: PROJECT_URL, etag: 'W/"abc"' })).toEqual({
        status: 200,
        etag: 'W/"def"',
        body: { id: 1, title: 'Roadmap' },
    });
});

test('asks unconditionally when no copy is held', async () => {
    const requests: Parameters<Fetch>[] = [];
    const rest = restAnswering(Response.json({ id: 1 }), requests);

    expect(await conditionalGet(rest, { url: PROJECT_URL })).toEqual({ status: 200, etag: undefined, body: { id: 1 } });
    expect(new Headers(requests[0]?.[1]?.headers).has('If-None-Match')).toBe(false);
});

function restAnswering(response: Response, requests: Parameters<Fetch>[] = []) {
    const fetch: Fetch = (...request) => {
        requests.push(request);
        return Promise.resolve(response);
    };

    return createGitHubRestRequester({ getToken: () => 'gho_token', fetch });
}
