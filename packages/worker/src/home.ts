import { SIGNED_IN_HINT_COOKIE } from '@githq/github/oauth.js';

import type { WorkerEnv } from './WorkerEnv.js';

/**
 * Where the prerendered landing page lives among the assets: `_landing.html`, which the assets serve at
 * `/_landing` (`html_handling: auto-trailing-slash` strips the extension, and `/_landing.html` itself only
 * redirects there). The Worker fetches it under this name; it is never a public address (see {@link serveLanding}).
 */
export const LANDING_PATH = '/_landing';

const HOME_PATH = '/';

/**
 * Whether the `Cookie` header carries the signed-in hint, `githq_signed_in=1` (`SIGNED_IN_HINT_COOKIE`).
 * Exact name and exact value: `githq_signed_in=0` or an empty value is not the hint, and other cookies are
 * ignored.
 */
function hasSignedInHint(request: Request): boolean {
    const header = request.headers.get('cookie') ?? '';
    return header
        .split(';')
        .some(pair => pair.trim() === `${SIGNED_IN_HINT_COOKIE.name}=${SIGNED_IN_HINT_COOKIE.value}`);
}

/**
 * Re-wraps an asset response with the headers that keep `/` correct. The address answers two different pages by
 * cookie, so a cache must neither reuse one for the other (`Vary: Cookie`) nor serve either without asking
 * (`no-cache`: revalidating is cheap, a stale landing for a signed-in visitor is not). Assets answer with
 * immutable headers, hence the copy. Anything but a 2xx (a broken deploy missing the landing, say) passes through
 * untouched: no invented fallback.
 */
function asHomeResponse(response: Response): Response {
    if (!response.ok) {
        return response;
    }
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-cache');
    const vary = (headers.get('Vary') ?? '')
        .split(',')
        .map(name => name.trim())
        .filter(name => name !== '');
    if (!vary.some(name => name === '*' || name.toLowerCase() === 'cookie')) {
        vary.push('Cookie');
    }
    headers.set('Vary', vary.join(', '));
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** A copy of `request` aimed at `path` of the same origin, same method and headers. */
function requestFor(request: Request, path: string): Request {
    return new Request(new URL(path, request.url).href, request);
}

/**
 * `/`: the SPA's shell (`index.html`) for a visitor with the signed-in hint, the prerendered landing page for
 * everyone else, whatever the query. The assets serve `/` as `index.html` and `/_landing` as the landing; the
 * binding does not run `run_worker_first` again, so neither fetch comes back here. Other methods than GET and
 * HEAD go to the assets as they are.
 */
export async function serveHome(request: Request, env: WorkerEnv): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return await env.ASSETS.fetch(request);
    }
    const target = hasSignedInHint(request) ? requestFor(request, HOME_PATH) : requestFor(request, LANDING_PATH);
    return asHomeResponse(await env.ASSETS.fetch(target));
}

/**
 * `/_landing` from outside: the SPA's shell, fetched as `/`. The landing has no address of its own, so it cannot
 * be reached (or indexed, or linked) apart from `/`, and the path stays reserved for the Worker's internal fetch.
 */
export async function serveLanding(request: Request, env: WorkerEnv): Promise<Response> {
    return asHomeResponse(await env.ASSETS.fetch(requestFor(request, HOME_PATH)));
}
