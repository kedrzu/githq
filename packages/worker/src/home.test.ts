import { describe, expect, test } from 'bun:test';

import { LANDING_PATH, serveHome, serveLanding } from './home.js';
import type { WorkerEnv } from './WorkerEnv.js';

// The assets are the system boundary: a stub that answers by pathname, as the real ones do (`/` is
// `index.html`, `/_landing` is `_landing.html`) and records what the Worker asked for.

const ORIGIN = 'https://githq.test';
const SHELL = '<html data-ssr="false">shell</html>';
const LANDING = '<html>Your GitHub issues, landing</html>';

function assets(overrides: Partial<Record<string, Response>> = {}) {
    const asked: Request[] = [];
    const env: WorkerEnv = {
        ASSETS: {
            fetch: request => {
                asked.push(request);
                const path = new URL(request.url).pathname;
                const body = path === '/' ? SHELL : path === LANDING_PATH ? LANDING : null;
                const response =
                    overrides[path] ??
                    new Response(request.method === 'HEAD' ? null : body, {
                        status: body === null ? 404 : 200,
                        headers: { 'content-type': 'text/html' },
                    });
                return Promise.resolve(response);
            },
        },
    };
    return { env, asked };
}

function get(path: string, cookie?: string, method = 'GET') {
    return new Request(`${ORIGIN}${path}`, { method, headers: cookie === undefined ? {} : { cookie } });
}

describe('serveHome', () => {
    test('with the hint cookie, / is the SPA shell, never the landing', async () => {
        const { env, asked } = assets();
        const response = await serveHome(get('/', 'githq_signed_in=1'), env);

        expect(await response.text()).toBe(SHELL);
        expect(asked.map(r => new URL(r.url).pathname)).toEqual(['/']);
    });

    test('tolerates other cookies and whitespace around the hint', async () => {
        const { env } = assets();
        const response = await serveHome(get('/', 'a=b;   githq_signed_in=1 ; c=d'), env);

        expect(await response.text()).toBe(SHELL);
    });

    test.each([
        ['no cookie', undefined],
        ['value 0', 'githq_signed_in=0'],
        ['empty value', 'githq_signed_in='],
        ['longer value', 'githq_signed_in=10'],
        ['longer name', 'xgithq_signed_in=1'],
        ['other cookies only', 'theme=dark'],
    ])('without the hint (%s), / is the landing', async (_name, cookie) => {
        const { env, asked } = assets();
        const response = await serveHome(get('/', cookie), env);

        expect(await response.text()).toBe(LANDING);
        expect(asked.map(r => new URL(r.url).pathname)).toEqual([LANDING_PATH]);
    });

    test('the query does not change the choice', async () => {
        const { env } = assets();

        expect(await (await serveHome(get('/?utm_source=x'), env)).text()).toBe(LANDING);
        expect(await (await serveHome(get('/?utm_source=x', 'githq_signed_in=1'), env)).text()).toBe(SHELL);
    });

    test('HEAD chooses the same and sends no body', async () => {
        const { env, asked } = assets();
        const landing = await serveHome(get('/', undefined, 'HEAD'), env);
        const shell = await serveHome(get('/', 'githq_signed_in=1', 'HEAD'), env);

        expect(landing.status).toBe(200);
        expect(shell.status).toBe(200);
        expect(await landing.text()).toBe('');
        expect(asked.map(r => [r.method, new URL(r.url).pathname])).toEqual([
            ['HEAD', LANDING_PATH],
            ['HEAD', '/'],
        ]);
    });

    test.each([undefined, 'githq_signed_in=1'])('both variants carry no-cache and Vary: Cookie (%s)', async cookie => {
        const { env } = assets();
        const response = await serveHome(get('/', cookie), env);

        expect(response.headers.get('cache-control')).toBe('no-cache');
        expect(response.headers.get('vary')).toBe('Cookie');
        expect(response.headers.get('content-type')).toBe('text/html');
    });

    test('appends Cookie to an existing Vary and works on immutable headers', async () => {
        const immutable = new Response(LANDING, {
            headers: { vary: 'Accept-Encoding', 'cache-control': 'max-age=60' },
        });
        const { env } = assets({ [LANDING_PATH]: immutable });
        const response = await serveHome(get('/'), env);

        expect(response.headers.get('vary')).toBe('Accept-Encoding, Cookie');
        expect(response.headers.get('cache-control')).toBe('no-cache');
    });

    test('passes a non-2xx answer from the assets through as it is', async () => {
        const missing = new Response('nope', { status: 404 });
        const { env } = assets({ [LANDING_PATH]: missing });
        const response = await serveHome(get('/'), env);

        expect(response).toBe(missing);
    });

    test('other methods go to the assets unchanged', async () => {
        const { env, asked } = assets();
        const request = new Request(`${ORIGIN}/`, { method: 'POST', body: 'x' });
        await serveHome(request, env);

        expect(asked).toEqual([request]);
    });
});

describe('serveLanding', () => {
    test.each([undefined, 'githq_signed_in=1'])(
        '/_landing is the SPA shell fetched as /, never the landing (%s)',
        async cookie => {
            const { env, asked } = assets();
            const response = await serveLanding(get(LANDING_PATH, cookie), env);

            expect(await response.text()).toBe(SHELL);
            expect(asked.map(r => new URL(r.url).pathname)).toEqual(['/']);
            expect(response.headers.get('cache-control')).toBe('no-cache');
            expect(response.headers.get('vary')).toBe('Cookie');
        },
    );
});
