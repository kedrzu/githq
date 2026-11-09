import { describe, expect, test } from 'bun:test';

import { isDocsPath, serveDocs } from './docs.js';
import worker from './worker.js';
import type { WorkerEnv } from './WorkerEnv.js';

// The assets are the system boundary: a stub that answers as the real ones do (`wrangler dev`, checked by hand):
// a file by its clean URL with its own ETag, `/docs/x.html` with a redirect to `/docs/x`, and any path with no file
// behind it with the SPA's shell, a 200 and the shell's ETag (`not_found_handling: single-page-application`).

const ORIGIN = 'https://githq.test';
const SHELL = '<html data-ssr="false">shell</html>';
const SHELL_ETAG = '"shell-etag"';
const DOCS_HOME = '<html>githq docs</html>';
const DOCS_PAGE = '<html>What is githq</html>';
const DOCS_NOT_FOUND = '<html>PAGE NOT FOUND</html>';

interface Asset {
    body: string;
    etag: string;
}

const SHELL_ASSET: Asset = { body: SHELL, etag: SHELL_ETAG };
const FILES: Record<string, Asset> = {
    '/': SHELL_ASSET,
    '/docs/': { body: DOCS_HOME, etag: '"docs-home"' },
    '/docs/getting-started/what-is-githq': { body: DOCS_PAGE, etag: '"docs-page"' },
    '/docs/404': { body: DOCS_NOT_FOUND, etag: '"docs-404"' },
};

function assets(overrides: Partial<Record<string, Response>> = {}) {
    const asked: Request[] = [];
    const env: WorkerEnv = {
        ASSETS: {
            fetch: request => {
                asked.push(request);
                const path = new URL(request.url).pathname;
                const override = overrides[path];
                if (override) {
                    return Promise.resolve(override);
                }
                if (path.endsWith('.html')) {
                    return Promise.resolve(
                        new Response(null, { status: 307, headers: { location: path.slice(0, -'.html'.length) } }),
                    );
                }
                const asset = FILES[path] ?? SHELL_ASSET;
                const headers = {
                    'content-type': 'text/html',
                    etag: asset.etag,
                    'cache-control': 'public, max-age=0, must-revalidate',
                };
                if (request.headers.get('if-none-match') === asset.etag) {
                    return Promise.resolve(new Response(null, { status: 304, headers }));
                }
                return Promise.resolve(
                    new Response(request.method === 'HEAD' ? null : asset.body, { status: 200, headers }),
                );
            },
        },
    };
    return { env, asked };
}

function get(path: string, init?: RequestInit) {
    return new Request(`${ORIGIN}${path}`, init);
}

describe('serveDocs', () => {
    test.each([
        ['/docs/', DOCS_HOME],
        ['/docs/getting-started/what-is-githq', DOCS_PAGE],
    ])('passes a docs page through untouched (%s)', async (path, body) => {
        const { env } = assets();
        const response = await serveDocs(get(path), env);

        expect(response.status).toBe(200);
        expect(await response.text()).toBe(body);
        expect(response.headers.get('etag')).not.toBe(SHELL_ETAG);
    });

    test('passes the docs’ redirects through, never following them', async () => {
        const { env } = assets();
        const response = await serveDocs(get('/docs/getting-started/what-is-githq.html'), env);

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe('/docs/getting-started/what-is-githq');
    });

    test('passes a revalidated docs page (304) through', async () => {
        const { env } = assets();
        const response = await serveDocs(get('/docs/', { headers: { 'if-none-match': '"docs-home"' } }), env);

        expect(response.status).toBe(304);
    });

    test('answers an unknown address with the docs’ 404 page and a 404, never the app’s shell', async () => {
        const { env, asked } = assets();
        const response = await serveDocs(get('/docs/nope'), env);

        expect(response.status).toBe(404);
        const body = await response.text();
        expect(body).toBe(DOCS_NOT_FOUND);
        expect(body).not.toContain(SHELL);
        expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
        expect(response.headers.get('cache-control')).toBe('no-cache');
        expect(response.headers.get('etag')).toBeNull();
        expect(asked.map(r => [r.method, new URL(r.url).pathname])).toEqual([
            ['GET', '/docs/nope'],
            ['HEAD', '/'],
            ['GET', '/docs/404'],
        ]);
    });

    test('a weak ETag of the shell is a miss too', async () => {
        const weakShell = new Response(SHELL, { headers: { etag: `W/${SHELL_ETAG}` } });
        const { env } = assets({ '/docs/weak': weakShell });
        const response = await serveDocs(get('/docs/weak'), env);

        expect(response.status).toBe(404);
        expect(await response.text()).toBe(DOCS_NOT_FOUND);
    });

    test('a 304 to a browser revalidating the shell it once got is a miss', async () => {
        const { env } = assets();
        const response = await serveDocs(get('/docs/nope', { headers: { 'if-none-match': SHELL_ETAG } }), env);

        expect(response.status).toBe(404);
        expect(await response.text()).toBe(DOCS_NOT_FOUND);
    });

    test('a 404 from the assets is a miss', async () => {
        const { env } = assets({ '/docs/gone': new Response('gone', { status: 404 }) });
        const response = await serveDocs(get('/docs/gone'), env);

        expect(response.status).toBe(404);
        expect(await response.text()).toBe(DOCS_NOT_FOUND);
    });

    test('HEAD of an unknown address is a 404 with no body', async () => {
        const { env, asked } = assets();
        const response = await serveDocs(get('/docs/nope', { method: 'HEAD' }), env);

        expect(response.status).toBe(404);
        expect(await response.text()).toBe('');
        expect(asked.at(-1)?.method).toBe('HEAD');
    });

    test('without the docs’ 404 page (a broken deploy) a plain 404, still never the shell', async () => {
        const { env } = assets({ '/docs/404': new Response('', { status: 404 }) });
        const response = await serveDocs(get('/docs/nope'), env);

        expect(response.status).toBe(404);
        expect(await response.text()).toBe('Not found');
    });

    test('other methods go to the assets unchanged', async () => {
        const { env, asked } = assets();
        const request = new Request(`${ORIGIN}/docs/nope`, { method: 'POST', body: 'x' });
        const response = await serveDocs(request, env);

        expect(response.status).toBe(200);
        expect(asked).toEqual([request]);
    });
});

test('isDocsPath takes /docs and below it, not pages of the app that merely start alike', () => {
    expect(['/docs', '/docs/', '/docs/x'].filter(isDocsPath)).toEqual(['/docs', '/docs/', '/docs/x']);
    expect(['/docsearch', '/acme/docs', '/'].filter(isDocsPath)).toEqual([]);
});

describe('the Worker', () => {
    const { env } = assets();

    test('sends /docs/* to the docs', async () => {
        expect(await (await worker.fetch(get('/docs/'), env)).text()).toBe(DOCS_HOME);
        const missing = await worker.fetch(get('/docs/nope'), env);
        expect(missing.status).toBe(404);
        expect(await missing.text()).toBe(DOCS_NOT_FOUND);
    });

    test('still sends / to the landing or the app, and an unknown API path to a JSON 404', async () => {
        const signedIn = await worker.fetch(get('/', { headers: { cookie: 'githq_signed_in=1' } }), env);
        expect(await signedIn.text()).toBe(SHELL);
        const api = await worker.fetch(get('/api/nope'), env);
        expect(api.status).toBe(404);
        expect(await api.json()).toEqual({ error: 'not_found' });
    });
});
