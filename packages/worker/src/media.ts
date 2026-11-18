import type { WorkerEnv } from './WorkerEnv.js';

/** The landing page's videos (`packages/app/public/landing/*.mp4`), the one kind of asset fetched by byte ranges. */
export function isMediaPath(pathname: string): boolean {
    return pathname.startsWith('/landing/') && pathname.endsWith('.mp4');
}

/** How long a browser keeps a video: a day, as it keeps its name when it is recorded again. */
const CACHE_CONTROL = 'public, max-age=86400';

/** One byte range of a file, both ends included. */
interface ByteRange {
    readonly start: number;
    readonly end: number;
}

/**
 * `/landing/*.mp4`: the video from the assets, a part of it when a `Range` asks for one. The assets answer every
 * request whole, with a 200, and Safari plays no video from a server that does that: it asks for the first two bytes
 * and gives up on a whole file. One range is answered with a 206, a range past the end with a 416; several ranges, or
 * one it can't read, get the whole file, which the standard allows.
 */
export async function serveMedia(request: Request, env: WorkerEnv): Promise<Response> {
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    headers.set('accept-ranges', 'bytes');
    headers.set('cache-control', CACHE_CONTROL);
    const header = request.headers.get('range');
    if (asset.status !== 200 || header === null) {
        return new Response(asset.body, { status: asset.status, headers });
    }

    const body = await asset.arrayBuffer();
    const range = parseRange(header, body.byteLength);
    if (range === undefined) {
        return new Response(body, { status: 200, headers });
    }
    if (range === null) {
        headers.delete('content-length');
        headers.set('content-range', `bytes */${body.byteLength}`);
        return new Response(null, { status: 416, headers });
    }

    headers.set('content-range', `bytes ${range.start}-${range.end}/${body.byteLength}`);
    headers.set('content-length', String(range.end - range.start + 1));
    return new Response(body.slice(range.start, range.end + 1), { status: 206, headers });
}

/**
 * The one range a `Range` header asks of a file of `size` bytes: `bytes=0-1`, `bytes=100-`, `bytes=-500`. `null`
 * when it starts past the end (416), `undefined` when the header is anything else — several ranges, another unit.
 */
function parseRange(header: string, size: number): ByteRange | null | undefined {
    const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
    if (!match) {
        return undefined;
    }

    const [, first = '', last = ''] = match;
    if (first === '') {
        if (last === '') {
            return undefined;
        }

        const suffix = Math.min(Number(last), size);
        return suffix === 0 ? null : { start: size - suffix, end: size - 1 };
    }

    const start = Number(first);
    if (start >= size) {
        return null;
    }

    const end = last === '' ? size - 1 : Math.min(Number(last), size - 1);
    return end < start ? undefined : { start, end };
}
