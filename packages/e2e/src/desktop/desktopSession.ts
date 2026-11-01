import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import type { GitHubMock } from '../github/GitHubMock.js';
import type { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_TOKEN, SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { DesktopSignInScreenHarness } from '../harnesses/DesktopSignInScreen.harness.js';
import { FirstSignInHarness } from '../harnesses/FirstSignIn.harness.js';
import { answerTrackingCandidates } from '../tracking/answerTracking.js';

import type { FakeNativeBridge } from './FakeNativeBridge.js';

/** The parameters of {@link signInOnDesktop}. */
export interface SignInOnDesktopParams {
    readonly page: Page;
    readonly github: GitHubMock;
    readonly native: FakeNativeBridge;
    /** What GitHub answers besides who the user is: "my work" and its items; nothing by default. */
    readonly world?: GitHubWorld;
}

/**
 * Signs in to the desktop app as {@link SAMPLE_VIEWER} with a device code, the native side approving it at once, goes
 * through the first sign-in's choice with nothing to track, and waits for the shell — and, given a `world`, for
 * "my work" to arrive.
 */
export async function signInOnDesktop({
    page,
    github,
    native,
    world,
}: SignInOnDesktopParams): Promise<AppShellHarness> {
    world?.install(github);
    github.graphql('Viewer', SAMPLE_VIEWER);
    answerTrackingCandidates(github, { login: SAMPLE_VIEWER.viewer.login });

    await page.goto('/login');
    const signIn = new DesktopSignInScreenHarness(page);
    await signIn.signInButton.click();
    await expect(signIn.deviceCode).toHaveText(native.deviceCode.userCode);
    native.approveDeviceSignIn(SAMPLE_TOKEN);
    await new FirstSignInHarness(page).continueButton.click();

    const shell = new AppShellHarness(page);
    await expect(shell.account(SAMPLE_VIEWER.viewer.login)).toBeVisible();
    if (world) {
        await expect(shell.myWorkCount('My work')).toHaveText(/^\d+$/);
    }

    return shell;
}

/** The values of the app's `localStorage` and `sessionStorage`, to look for the token in. */
export async function readWebStorage(page: Page): Promise<string[]> {
    return await page.evaluate(() =>
        [localStorage, sessionStorage].flatMap(storage =>
            Array.from({ length: storage.length }, (_, index) => {
                const key = storage.key(index) ?? '';
                return `${key}=${storage.getItem(key) ?? ''}`;
            }),
        ),
    );
}
