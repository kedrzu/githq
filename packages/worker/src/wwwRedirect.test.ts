import { expect, test } from 'bun:test';

import wwwRedirect from './wwwRedirect.js';

test('redirects www to the same path and query on githq.dev', () => {
    const response = wwwRedirect.fetch(new Request('https://www.githq.dev/kedrzu/githq/issues/4?view=board'));

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://githq.dev/kedrzu/githq/issues/4?view=board');
});

test('redirects plain http to https', () => {
    const response = wwwRedirect.fetch(new Request('http://www.githq.dev/'));

    expect(response.headers.get('location')).toBe('https://githq.dev/');
});
