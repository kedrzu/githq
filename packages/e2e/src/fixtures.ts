import { existsSync } from 'node:fs';
import path from 'node:path';

import { test as base } from '@playwright/test';

import { GitHubMock } from './github/GitHubMock.js';
import { E2E_BASE_URL } from './localApp.js';

/** The local build the Worker serves in the tests (`--assets` in `playwright.config.ts`). */
const LOCAL_BUILD = path.join(import.meta.dirname, '../../app/.output-local/public');

/** Where the build keeps its hashed, immutable files: the JS chunks and the CSS. */
export const BUILD_ASSETS_PATH = '/_nuxt/';

/** Marks a build asset {@link localAssets} answered from the disk, never sent to the Worker. */
export const LOCAL_ASSET_HEADER = 'x-githq-e2e-asset';

export interface E2eFixtures {
    /**
     * GitHub, as this test answers it: every request of the test's browser to a GitHub host goes to it. Set
     * up in every test, used or not; a request it was not told to answer fails the test when it ends.
     */
    github: GitHubMock;
    /**
     * The app's build assets (`/_nuxt/*`) answered from the local build on the disk instead of by `wrangler dev`, whose
     * asset server takes most of a page load once the workers run in parallel: routing (the GitHub mock) turns off the
     * browser's cache, so every load fetches all ~150 chunks again. The Worker still serves the pages, `/`, deep links
     * and `/api/*`, and `globalSetup` checks it serves the assets too.
     */
    localAssets: void;
}

/** The e2e `test`: a browser that never reaches GitHub ({@link GitHubMock}). */
export const test = base.extend<E2eFixtures>({
    localAssets: [
        async ({ context }, use) => {
            const origin = new URL(E2E_BASE_URL).origin;
            await context.route(
                url => url.origin === origin && url.pathname.startsWith(BUILD_ASSETS_PATH),
                async route => {
                    const file = path.join(LOCAL_BUILD, new URL(route.request().url()).pathname);
                    if (!file.startsWith(LOCAL_BUILD + path.sep) || !existsSync(file)) {
                        // The Worker's own answer, a 404 included.
                        await route.continue();
                        return;
                    }
                    await route.fulfill({ path: file, headers: { [LOCAL_ASSET_HEADER]: 'disk' } });
                },
            );
            await use();
        },
        { auto: true },
    ],
    github: [
        async ({ context }, use) => {
            const github = new GitHubMock();
            await github.install(context);
            await use(github);
            github.assertAllRouted();
        },
        { auto: true },
    ],
});

export { expect } from '@playwright/test';
