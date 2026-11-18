import { defineConfig } from '@playwright/test';

import config from './playwright.config.js';

// The README's demo (`src/demo/*.demo.ts`), recorded frame by frame against the mocked GitHub, as the e2e tests run;
// `src/demo/recordReadmeDemo.ts` runs it and encodes the frames. Not a test: `bun run e2e` never runs it.
export default defineConfig({
    ...config,
    testMatch: /\.demo\.ts$/,
    fullyParallel: false,
    reporter: [['list']],
    outputDir: './demo-results',
    use: {
        ...config.use,
        // The app's dense desktop layout; a README shows it a little smaller still.
        viewport: { width: 1280, height: 760 },
        trace: 'off',
        screenshot: 'off',
    },
    projects: [{ name: 'demo' }],
    // Only the local build behind the Worker; the desktop build's server is the desktop tests'.
    webServer: Array.isArray(config.webServer) ? config.webServer.slice(0, 1) : config.webServer,
});
