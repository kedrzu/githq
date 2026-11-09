import type { WorkerEnv } from './WorkerEnv.js';

/**
 * The documentation site's place among the assets and on githq.dev: `docs/` in the app's build (`packages/docs`,
 * copied there by `packages/app/scripts/copyDocs.ts`), served at `/docs/`. `/docs` alone never reaches the Worker:
 * the assets redirect it to `/docs/` first.
 */
export const DOCS_PATH = '/docs';

/**
 * The docs' page for an address they do not have. VitePress writes it as `404.html`; the assets serve it here, and
 * `/docs/404.html` only redirects to it (`html_handling`), as every page with `cleanUrls`.
 */
const DOCS_NOT_FOUND_PATH = '/docs/404';

/** The SPA's shell, which the assets answer every path with no file behind it with (`not_found_handling`). */
const SHELL_PATH = '/';

/** Whether `pathname` is the docs' (`/docs` or below it), not a page of the app such as `/docsearch`. */
export function isDocsPath(pathname: string): boolean {
    return pathname === DOCS_PATH || pathname.startsWith(`${DOCS_PATH}/`);
}

/**
 * `/docs/*`: the docs' file for the address, or their 404 page with a 404 status when they have none. The assets
 * alone would answer an unknown `/docs/...` with the SPA's shell and a 200 (`not_found_handling:
 * single-page-application`), so the app would open on an address it has no screen for, and a search engine would
 * index it. A miss is told by the answer: a 404, or the shell — the same ETag as the shell's (a 200, or a 304 to a
 * browser revalidating what it once got). Everything else, the docs' redirects (`/docs/x.html` → `/docs/x`) among it,
 * passes through untouched. Other methods than GET and HEAD go to the assets as they are.
 */
export async function serveDocs(request: Request, env: WorkerEnv): Promise<Response> {
    const response = await env.ASSETS.fetch(request);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return response;
    }
    if (!(await isMiss(response, request, env))) {
        return response;
    }
    await response.body?.cancel();
    return await notFound(request, env);
}

async function isMiss(response: Response, request: Request, env: WorkerEnv): Promise<boolean> {
    if (response.status === 404) {
        return true;
    }
    const etag = response.headers.get('etag');
    if (etag === null || (response.status !== 200 && response.status !== 304)) {
        return false;
    }
    const shell = await env.ASSETS.fetch(new Request(new URL(SHELL_PATH, request.url).href, { method: 'HEAD' }));
    const shellEtag = shell.headers.get('etag');
    return shellEtag !== null && strongPart(shellEtag) === strongPart(etag);
}

/** An ETag without its weak marker: the assets may send either form of the same tag. */
function strongPart(etag: string): string {
    return etag.replace(/^W\//, '');
}

/**
 * The docs' 404 page with a 404 status, fetched afresh (no conditional headers, so never a 304) and without its
 * ETag, so a browser holds nothing to revalidate it by. `no-cache`: after a deploy the address may well exist. When
 * the page itself is missing (a broken deploy), a plain 404 — still never the app.
 */
async function notFound(request: Request, env: WorkerEnv): Promise<Response> {
    const page = await env.ASSETS.fetch(
        new Request(new URL(DOCS_NOT_FOUND_PATH, request.url).href, { method: request.method }),
    );
    if (!page.ok) {
        return new Response(request.method === 'HEAD' ? null : 'Not found', {
            status: 404,
            headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache' },
        });
    }
    const headers = new Headers(page.headers);
    headers.delete('etag');
    headers.delete('last-modified');
    headers.set('content-type', 'text/html; charset=utf-8');
    headers.set('cache-control', 'no-cache');
    return new Response(page.body, { status: 404, statusText: 'Not Found', headers });
}
