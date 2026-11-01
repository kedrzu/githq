import type { Page } from '@playwright/test';

import { SAMPLE_TOKEN, SAMPLE_VIEWER } from '../github/sampleViewer.js';
import type { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { DesktopSignInScreenHarness } from '../harnesses/DesktopSignInScreen.harness.js';
import { FirstSignInHarness } from '../harnesses/FirstSignIn.harness.js';
import { answerTrackingCandidates } from '../tracking/answerTracking.js';

import { expect, test } from './desktopFixtures.js';
import { signInOnDesktop } from './desktopSession.js';

test("on a Mac the sidebar's top is kept for the window controls and moves the window, and the rail has room for them", async ({
    page,
    github,
    native,
}) => {
    await pretendOS(page, 'macOS');
    const shell = await signInOnDesktop({ page, github, native });

    await expect(shell.sidebar.locator('[data-tauri-drag-region]')).toHaveCSS('height', '36px');
    await expect(page.getByRole('main').locator('header').first()).toHaveAttribute('data-tauri-drag-region', 'deep');
    await expectRail(shell, 80);
});

test('on a Mac the screens with no sidebar move the window too, with nothing under the window controls', async ({
    page,
    github,
    native,
}) => {
    await pretendOS(page, 'macOS');
    github.graphql('Viewer', SAMPLE_VIEWER);
    answerTrackingCandidates(github, { login: SAMPLE_VIEWER.viewer.login });

    await page.goto('/login');
    const signIn = new DesktopSignInScreenHarness(page);
    await expect(page.locator('[data-tauri-drag-region]')).toHaveCSS('height', '36px');
    await signIn.signInButton.click();
    await expect(signIn.deviceCode).toHaveText(native.deviceCode.userCode);
    native.approveDeviceSignIn(SAMPLE_TOKEN);

    await expect(new FirstSignInHarness(page).continueButton).toBeVisible();
    await expect(page.locator('header[data-tauri-drag-region="deep"]')).toBeVisible();
    const name = await page.getByRole('img', { name: 'githq' }).boundingBox();
    expect(name?.x).toBeGreaterThan(70);
});

test('with a title bar of its own, as on Windows, nothing changes', async ({ page, github, native }) => {
    await pretendOS(page, 'Windows');
    const shell = await signInOnDesktop({ page, github, native });

    await expectRail(shell, 56);
    await expect(page.locator('[data-tauri-drag-region]')).toHaveCount(0);
});

/** Collapses the sidebar: the rail, and the status bar's segment under it, are `width` wide. */
async function expectRail(shell: AppShellHarness, width: number) {
    await shell.collapseButton.click();
    await expect(shell.expandButton).toBeVisible();
    const segment = shell.statusBar.locator('> *').first();
    // Reka lays the panels out in fractions of the window, a little off a whole pixel.
    await expect.poll(async () => Math.round((await shell.sidebar.boundingBox())?.width ?? 0)).toBe(width);
    await expect.poll(async () => Math.round((await segment.boundingBox())?.width ?? 0)).toBe(width);
}

/** Has the page report this operating system, whichever this test runs on. */
async function pretendOS(page: Page, platform: string) {
    await page.addInitScript(value => {
        Object.defineProperty(navigator, 'userAgentData', { value: { platform: value } });
    }, platform);
}
