import { defineConfig } from '@playwright/test';

import { E2E_BASE_URL, E2E_PORT } from './src/localApp.js';

// End-to-end tests: the built app in the local Workers runtime, so what would break on Cloudflare breaks here.
// GitHub is never reached: every request to it is answered by the `github` fixture (`src/github/GitHubMock.ts`),
// and one nobody answered fails the test. Run with `bun run e2e`.
export default defineConfig({
    testDir: './src',
    testMatch: /\.spec\.ts$/,
    // Checks, once the server is up, that it is the app on this machine with the e2e Worker configuration.
    globalSetup: './src/globalSetup.ts',
    fullyParallel: true,
    forbidOnly: true,
    // A flaky test is a red to fix, not to retry away.
    retries: 0,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL: E2E_BASE_URL,
        browserName: 'chromium',
        // A desktop, as githq is made for.
        viewport: { width: 1440, height: 900 },
        // The screens' own test ids (`tid="…"`), as in the component tests.
        testIdAttribute: 'tid',
        // A failed test leaves its trace (`bunx playwright show-trace <trace.zip>`) and a screenshot in
        // `test-results/`; `bun --cwd packages/e2e report` opens the HTML report with both.
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    webServer: {
        // The local build fresh, then the Worker serving it — so the tests never run a stale build or someone
        // else's server. `--host`: the Worker sees the app's origin as this port (`dev.host` in `wrangler.jsonc`
        // says 8787, `bun run dev`'s), so its OAuth callback is this server's. `--env-file`: the dummy OAuth App
        // of `worker.vars` instead of the real `.env`.
        command: [
            'bun --cwd ../app build:local',
            [
                'bun --cwd ../worker preview',
                `--port ${E2E_PORT}`,
                `--host localhost:${E2E_PORT}`,
                '--assets ../app/.output-local/public',
                '--env-file ../e2e/worker.vars',
            ].join(' '),
        ].join(' && '),
        url: E2E_BASE_URL,
        reuseExistingServer: false,
        timeout: 180_000,
        stdout: 'ignore',
        stderr: 'pipe',
        gracefulShutdown: { signal: 'SIGINT', timeout: 5000 },
    },
});
