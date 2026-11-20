/**
 * The Worker's environment: its bindings. The secrets among them (`GITHUB_CLIENT_SECRET`, declared in
 * `@githq/secrets`) are not typed here: the Worker resolves them through its container (`workerContainer.ts`). The
 * OAuth App's client secret is set with `wrangler secret put` in production and comes from the secret store for
 * `wrangler dev`. A checkout that cannot read the store runs without it: the auth endpoints then answer 500
 * `not_configured` instead of sending a half-built request to GitHub.
 */
export interface WorkerEnv {
    /**
     * The static assets (the SPA's build, `wrangler.jsonc` `assets.binding`). Typed by the one method the Worker
     * uses, since the project has no `@cloudflare/workers-types`. Fetching through it does not run the Worker
     * again (`run_worker_first` applies to outside requests only).
     */
    ASSETS: { fetch(request: Request): Promise<Response> };
    /**
     * Workers Analytics Engine, where usage is counted (`wrangler.jsonc` `analytics_engine_datasets`, `usage.ts`).
     * Typed by the one method used, like {@link WorkerEnv.ASSETS}. Optional: a Worker without it counts nothing.
     */
    USAGE?: { writeDataPoint(dataPoint: AnalyticsEngineDataPoint): void };
    /** Which OAuth App this is: `prod`, `dev` or `e2e` (`getOAuthClientId`). */
    GITHQ_ENV?: string;
    /** The other bindings, the secrets among them, read only through the Worker's container. */
    readonly [binding: string]: unknown;
}

/** One row written to Workers Analytics Engine; the subset of Cloudflare's type the Worker writes. */
export interface AnalyticsEngineDataPoint {
    blobs: string[];
    doubles: number[];
    indexes: string[];
}
