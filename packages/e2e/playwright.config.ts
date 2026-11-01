import { defineConfig } from '@playwright/test';

import { DESKTOP_PROJECT, E2E_BASE_URL, E2E_CLIENT_ID, E2E_DESKTOP_BASE_URL, E2E_PORT } from './src/localApp.js';

// End-to-end tests: the built app in the local Workers runtime, so what would break on Cloudflare breaks here.
// GitHub is never reached: every request to it is answered by the `github` fixture (`src/github/GitHubMock.ts`),
// and one nobody answered fails the test. Run with `bun run e2e`.
// The `desktop` project (`src/desktop/`) runs the desktop app's build in the browser, its native side faked
// (`src/desktop/FakeNativeBridge.ts`).
export default defineConfig({
    testDir: './src',
    testMatch: /\.spec\.ts$/,
    // Checks, once the servers are up, that they are the app on this machine with the e2e configuration.
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
    projects: [
        {
            name: 'web',
            testIgnore: /\/desktop\//,
        },
        {
            name: DESKTOP_PROJECT,
            testMatch: /\/desktop\/.*\.spec\.ts$/,
            use: {
                baseURL: E2E_DESKTOP_BASE_URL,
                // The desktop sign-in copies the device code.
                permissions: ['clipboard-read', 'clipboard-write'],
            },
        },
    ],
    webServer: [
        {
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
        {
            // The desktop app's build fresh, with the dummy OAuth App's client ID, then a static server — as the
            // desktop app's window loads it, without a Worker.
            command: [
                `GITHQ_GITHUB_CLIENT_ID=${E2E_CLIENT_ID} bun --cwd ../app build:desktop`,
                'bun src/desktop/serveDesktopApp.ts',
            ].join(' && '),
            url: E2E_DESKTOP_BASE_URL,
            reuseExistingServer: false,
            timeout: 180_000,
            stdout: 'ignore',
            stderr: 'pipe',
            gracefulShutdown: { signal: 'SIGINT', timeout: 5000 },
        },
    ],
});
