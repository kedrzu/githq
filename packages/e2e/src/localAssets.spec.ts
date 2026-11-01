import type { Response } from '@playwright/test';

import { BUILD_ASSETS_PATH, LOCAL_ASSET_HEADER, expect, test } from './fixtures.js';
import { SAMPLE_VIEWER } from './github/sampleViewer.js';
import { signIn } from './session.js';

// The harness's own guarantee (`localAssets` in `fixtures.ts`): the build's assets come from the disk, so the tests
// never wait on `wrangler dev`'s asset server, and the app still loads and runs from them.

test("the app's build assets come from the local build on the disk, never from the Worker", async ({
    page,
    github,
}) => {
    const assets: Response[] = [];
    page.on('response', response => {
        if (new URL(response.url()).pathname.startsWith(BUILD_ASSETS_PATH)) {
            assets.push(response);
        }
    });

    const shell = await signIn(page, github);
    await page.reload();
    await expect(shell.account(SAMPLE_VIEWER.viewer.login)).toBeVisible();

    expect(assets.length).toBeGreaterThan(0);
    const fromWorker = assets.filter(response => response.headers()[LOCAL_ASSET_HEADER] !== 'disk');
    expect(fromWorker.map(response => response.url())).toEqual([]);
    const scripts = assets.filter(response => response.url().endsWith('.js'));
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
        expect(script.headers()['content-type'], script.url()).toMatch(/javascript/);
    }
});
