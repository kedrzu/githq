/**
 * The Worker's environment. The OAuth App's client secret is set with `wrangler secret put` in production and comes
 * from the secret store or the repo root `.env` for `wrangler dev`. Optional in the type because a checkout with
 * neither runs without it: the auth endpoints then answer 500 `not_configured` instead of sending a half-built request
 * to GitHub.
 */
export interface WorkerEnv {
    /**
     * The static assets (the SPA's build, `wrangler.jsonc` `assets.binding`). Typed by the one method the Worker
     * uses, since the project has no `@cloudflare/workers-types`. Fetching through it does not run the Worker
     * again (`run_worker_first` applies to outside requests only).
     */
    ASSETS: { fetch(request: Request): Promise<Response> };
    /** Which OAuth App this is: `prod`, `dev` or `e2e` (`getOAuthClientId`). */
    GITHQ_ENV?: string;
    /** Secret: used only in the Worker's own request to GitHub's token endpoint, never in a response or log. */
    GITHUB_CLIENT_SECRET?: string;
}
