/**
 * The `githq-www` Worker (`wrangler.www.jsonc`): `www.githq.dev` answers every request with a permanent redirect
 * to the same path and query on `githq.dev`, so the app lives on one origin — the one its OAuth callback and the
 * browser's IndexedDB belong to. A Worker of its own because the githq Worker never sees requests for the SPA's
 * paths: Cloudflare answers them from the assets first.
 */
export default {
    fetch(request: Request): Response {
        const url = new URL(request.url);
        url.protocol = 'https:';
        url.hostname = 'githq.dev';
        url.port = '';
        return Response.redirect(url.href, 301);
    },
};
