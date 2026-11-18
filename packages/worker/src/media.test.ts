import { expect, test } from 'bun:test';

import worker from './worker.js';
import type { WorkerEnv } from './WorkerEnv.js';

// The assets answer every request whole, as Cloudflare's do: the Worker cuts the range out.

const VIDEO = new Uint8Array(Array.from({ length: 100 }, (_, index) => index));
const ENV: WorkerEnv = {
    ASSETS: {
        fetch: request =>
            Promise.resolve(
                new URL(request.url).pathname === '/landing/hero.mp4'
                    ? new Response(VIDEO, { headers: { 'content-type': 'video/mp4', etag: '"v1"' } })
                    : new Response('not found', { status: 404 }),
            ),
    },
};

function get(path: string, range?: string) {
    const headers = range === undefined ? undefined : { range };
    return worker.fetch(new Request(`https://githq.test${path}`, { headers }), ENV);
}

test("Safari's first ask, the first two bytes, gets them alone, with the file's size", async () => {
    const response = await get('/landing/hero.mp4', 'bytes=0-1');

    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 0-1/100');
    expect(response.headers.get('content-length')).toBe('2');
    expect(response.headers.get('content-type')).toBe('video/mp4');
    expect(response.headers.get('etag')).toBe('"v1"');
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([0, 1]);
});

test.each([
    ['bytes=90-', 'bytes 90-99/100', [90, 99]],
    ['bytes=-3', 'bytes 97-99/100', [97, 99]],
    ['bytes=95-500', 'bytes 95-99/100', [95, 99]],
])('%s gets %s', async (range, contentRange, [first, last]) => {
    const response = await get('/landing/hero.mp4', range);

    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe(contentRange);
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([bytes[0], bytes.at(-1)]).toEqual([first, last]);
});

test('a range past the end gets a 416 with the size', async () => {
    const response = await get('/landing/hero.mp4', 'bytes=100-');

    expect(response.status).toBe(416);
    expect(response.headers.get('content-range')).toBe('bytes */100');
});

test.each([[undefined], ['bytes=0-1,5-9'], ['items=0-1']])(
    '%s gets the whole file, saying ranges work',
    async range => {
        const response = await get('/landing/hero.mp4', range);

        expect(response.status).toBe(200);
        expect(response.headers.get('accept-ranges')).toBe('bytes');
        expect(response.headers.get('cache-control')).toBe('public, max-age=86400');
        expect((await response.arrayBuffer()).byteLength).toBe(100);
    },
);

test('a video the assets do not have stays their 404', async () => {
    const response = await get('/landing/missing.mp4', 'bytes=0-1');

    expect(response.status).toBe(404);
});
