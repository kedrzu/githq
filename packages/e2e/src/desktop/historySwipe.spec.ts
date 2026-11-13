import type { Page } from '@playwright/test';

import { SAMPLE_VIEWER } from '../github/sampleViewer.js';

import { expect, test } from './desktopFixtures.js';
import { signInOnDesktop } from './desktopSession.js';
import type { FakeNativeBridge } from './FakeNativeBridge.js';

const ACCOUNT = '/settings?tab=account';

test.beforeEach(async ({ page, github, native }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'userAgentData', { value: { platform: 'macOS' } });
    });
    const shell = await signInOnDesktop({ page, github, native });
    await shell.openAccount(SAMPLE_VIEWER.viewer.login);
    await expect(page).toHaveURL(ACCOUNT);
    await expect.poll(() => native.isListening('scroll-phase')).toBe(true);
    await page.mouse.move(400, 300);
});

test('on a Mac a two-finger swipe to the right goes back as the fingers lift, not while they rest, with an arrow from the left edge; to the left it goes forward', async ({
    page,
    native,
}) => {
    const arrow = page.locator('[class*="historySwipe"]');

    await native.sendScrollPhase('began');
    await wheel(page, -60);
    await expect(arrow).toBeVisible();
    await wheel(page, -100);
    // Resting, far enough.
    await page.waitForTimeout(400);
    await expect(page).toHaveURL(ACCOUNT);

    await native.sendScrollPhase('ended');
    await expect(page).not.toHaveURL(ACCOUNT, { timeout: 200 });
    await expect(arrow).toBeHidden();

    await swipe(page, native, 160);
    await expect(page).toHaveURL(ACCOUNT);
});

test('a short swipe, a vertical scroll, a swipe over something that scrolls sideways, a cancelled one and scrolling with no fingers down stay where they are', async ({
    page,
    native,
}) => {
    await swipe(page, native, -30);
    await swipe(page, native, 0, -200);

    await native.sendScrollPhase('began');
    await wheel(page, -200);
    await native.sendScrollPhase('cancelled');

    // Coasting on after a swipe, or a mouse's wheel: no phases.
    await wheel(page, -200);

    // Scrolled to the middle of its content, it can scroll either way.
    await page.evaluate(() => {
        const scroller = document.createElement('div');
        scroller.style.cssText = 'position: fixed; inset: 0; z-index: 1000; overflow-x: auto';
        scroller.innerHTML = '<div style="width: 400vw; height: 10px"></div>';
        document.body.append(scroller);
        scroller.scrollLeft = 500;
    });
    await swipe(page, native, -200);

    await page.waitForTimeout(300);
    await expect(page).toHaveURL(ACCOUNT);
});

/** Fingers down, a scroll by `x` and `y` (`-x` goes back), fingers up. */
async function swipe(page: Page, native: FakeNativeBridge, x: number, y = 0) {
    await native.sendScrollPhase('began');
    await wheel(page, x, y);
    await native.sendScrollPhase('ended');
}

/**
 * Scrolls by `x` and `y` and waits for the page to see it: the browser dispatches a wheel event after `wheel` resolves.
 * The listener is in place before the scroll: the page's script and the input are not ordered, so a scroll sent
 * alongside an `evaluate` that adds it can pass first and leave the wait hanging.
 */
async function wheel(page: Page, x: number, y = 0) {
    // Wrapped in an object, so that the handle comes back without waiting for the promise.
    const listener = await page.evaluateHandle(() => ({
        seen: new Promise<void>(resolve => {
            window.addEventListener('wheel', () => resolve(), { once: true });
        }),
    }));
    await page.mouse.wheel(x, y);
    await listener.evaluate(({ seen }) => seen);
}
