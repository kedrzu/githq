import type { Page } from '@playwright/test';

import { SAMPLE_VIEWER } from '../github/sampleViewer.js';

import { expect, test } from './desktopFixtures.js';
import { signInOnDesktop } from './desktopSession.js';

const ACCOUNT = '/settings?tab=account';

test.beforeEach(async ({ page, github, native }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'userAgentData', { value: { platform: 'macOS' } });
    });
    const shell = await signInOnDesktop({ page, github, native });
    await shell.openAccount(SAMPLE_VIEWER.viewer.login);
    await expect(page).toHaveURL(ACCOUNT);
    await page.mouse.move(400, 300);
});

test('on a Mac a two-finger swipe to the right goes back, with an arrow from the left edge, and to the left forward', async ({
    page,
}) => {
    const arrow = page.locator('[class*="historySwipe"]');

    await page.mouse.wheel(-60, 0);
    await expect(arrow).toBeVisible();
    await page.mouse.wheel(-100, 0);
    await expect(page).not.toHaveURL(ACCOUNT);
    await expect(arrow).toBeHidden();

    await swipeAfterQuiet(page, 160);
    await expect(page).toHaveURL(ACCOUNT);
});

test('a short swipe, a vertical scroll and a swipe over something that scrolls sideways stay where they are', async ({
    page,
}) => {
    await swipeAfterQuiet(page, -30);
    await expect(page).toHaveURL(ACCOUNT);

    await swipeAfterQuiet(page, 0, -200);
    await expect(page).toHaveURL(ACCOUNT);

    // Scrolled to the middle of its content, it can scroll either way.
    await page.evaluate(() => {
        const scroller = document.createElement('div');
        scroller.id = 'scroller';
        scroller.style.cssText = 'position: fixed; inset: 0; z-index: 1000; overflow-x: auto';
        scroller.innerHTML = '<div style="width: 400vw; height: 10px"></div>';
        document.body.append(scroller);
        scroller.scrollLeft = 500;
    });
    await swipeAfterQuiet(page, -200);
    await expect(page).toHaveURL(ACCOUNT);
});

/** A swipe once the last one is over, as the fingers come down again: `-x` goes back. */
async function swipeAfterQuiet(page: Page, x: number, y = 0) {
    await page.waitForTimeout(300);
    await page.mouse.wheel(x, y);
    await page.waitForTimeout(300);
}
