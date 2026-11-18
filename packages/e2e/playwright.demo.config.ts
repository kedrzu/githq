import { defineConfig } from '@playwright/test';

import config from './playwright.config.js';

// The demos (`src/demo/*.demo.ts`) — the README's and the landing page's pictures —, recorded against the mocked GitHub,
// as the e2e tests run; `src/demo/recordDemo.ts` runs one and encodes what it wrote. Not a test: `bun run e2e` never
// runs it.
export default defineConfig({
    ...config,
    testMatch: /\.demo\.ts$/,
    fullyParallel: false,
    reporter: [['list']],
    outputDir: './demo-results',
    use: {
        ...config.use,
        // The app's dense desktop layout; a README shows it a little smaller still. The landing page's set their own.
        viewport: { width: 1280, height: 760 },
        trace: 'off',
        screenshot: 'off',
    },
    projects: [{ name: 'demo' }],
    // Only the local build behind the Worker; the desktop build's server is the desktop tests'.
    webServer: Array.isArray(config.webServer) ? config.webServer.slice(0, 1) : config.webServer,
});
