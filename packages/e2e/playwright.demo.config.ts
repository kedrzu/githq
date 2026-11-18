import { defineConfig } from '@playwright/test';

import config from './playwright.config.js';

/** The size the README's demo is recorded at: the app's dense desktop layout, small enough for a light animation. */
const DEMO_VIEWPORT = { width: 1280, height: 760 };

// The README's demo (`src/demo/*.demo.ts`), recorded as a video against the mocked GitHub, as the e2e tests run;
// `src/demo/recordReadmeDemo.ts` runs it and turns the video into `docs/assets/readme/demo.webp`. Not a test: `bun run
// e2e` never runs it.
export default defineConfig({
    ...config,
    testMatch: /\.demo\.ts$/,
    fullyParallel: false,
    reporter: [['list']],
    outputDir: './demo-results',
    use: {
        ...config.use,
        viewport: DEMO_VIEWPORT,
        video: { mode: 'on', size: DEMO_VIEWPORT },
        trace: 'off',
        screenshot: 'off',
    },
    projects: [{ name: 'demo' }],
    // Only the local build behind the Worker; the desktop build's server is the desktop tests'.
    webServer: Array.isArray(config.webServer) ? config.webServer.slice(0, 1) : config.webServer,
});
