/**
 * The Worker's environment. The two OAuth values are the githq OAuth App's credentials (D3): set with
 * `wrangler secret put` in production and in the repo root `.env` for `wrangler dev` (`.env.example`). Optional in
 * the type because a checkout without `.env` runs without them — the auth endpoints then answer 500
 * `not_configured` instead of sending a half-built request to GitHub.
 */
export interface WorkerEnv {
    /**
     * The static assets (the SPA's build, `wrangler.jsonc` `assets.binding`). Typed by the one method the Worker
     * uses, since the project has no `@cloudflare/workers-types`. Fetching through it does not run the Worker
     * again (`run_worker_first` applies to outside requests only).
     */
    ASSETS: { fetch(request: Request): Promise<Response> };
    /** Public: it goes into the authorize URL the browser is sent to. */
    GITHUB_CLIENT_ID?: string;
    /** Secret: used only in the Worker's own request to GitHub's token endpoint, never in a response or log. */
    GITHUB_CLIENT_SECRET?: string;
}
