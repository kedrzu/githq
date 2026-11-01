import { SAMPLE_TOKEN, SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { DesktopSignInScreenHarness } from '../harnesses/DesktopSignInScreen.harness.js';
import { FirstSignInHarness } from '../harnesses/FirstSignIn.harness.js';
import { answerTrackingCandidates } from '../tracking/answerTracking.js';

import { expect, test } from './desktopFixtures.js';
import { readWebStorage, signInOnDesktop } from './desktopSession.js';

const LOGIN = SAMPLE_VIEWER.viewer.login;

test("signing in shows a device code, opens GitHub's device page in the system browser, and lands in the app once GitHub approves it — asking githq's servers nothing", async ({
    page,
    github,
    native,
    githqRequests,
}) => {
    github.graphql('Viewer', SAMPLE_VIEWER);
    answerTrackingCandidates(github, { login: LOGIN });

    await page.goto('/');
    await expect(page).toHaveURL('/login?next=/');
    const signIn = new DesktopSignInScreenHarness(page);
    await signIn.signInButton.click();
    await expect(signIn.deviceCode).toHaveText('WDJB-MJHT');

    await signIn.copyAndOpenButton.click();
    await expect.poll(() => native.opened).toEqual(['https://github.com/login/device']);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('WDJB-MJHT');
    // The window stays on the code, waiting for GitHub.
    await expect(page).toHaveURL('/login?next=/');
    await expect(signIn.deviceCode).toBeVisible();

    native.approveDeviceSignIn(SAMPLE_TOKEN);
    await expect(page).toHaveURL('/settings/tracking/new');
    await new FirstSignInHarness(page).continueButton.click();
    await expect(new AppShellHarness(page).account(LOGIN)).toBeVisible();
    await expect(page).toHaveURL('/');

    expect(githqRequests).toEqual([]);
    expect(page.context().pages()).toHaveLength(1);
});

test('the token is kept in the OS keychain, never in web storage — signed in after a reload — and signing out deletes it', async ({
    page,
    github,
    native,
}) => {
    const shell = await signInOnDesktop({ page, github, native });

    expect(native.keychain).toBe(SAMPLE_TOKEN);
    expect(await readWebStorage(page)).not.toContainEqual(expect.stringContaining(SAMPLE_TOKEN));

    // A new start of the app reads the token from the keychain.
    await page.reload();
    await expect(shell.account(LOGIN)).toBeVisible();
    expect(await readWebStorage(page)).not.toContainEqual(expect.stringContaining(SAMPLE_TOKEN));

    await shell.signOut(LOGIN);
    await expect(page).toHaveURL(/^[^?]*\/login\?next=/);
    await expect(new DesktopSignInScreenHarness(page).signInButton).toBeVisible();
    await expect.poll(() => native.keychain).toBeNull();
    expect(await readWebStorage(page)).not.toContainEqual(expect.stringContaining(SAMPLE_TOKEN));

    // Started again, the app is signed out.
    await page.reload();
    await expect(new DesktopSignInScreenHarness(page).signInButton).toBeVisible();
});
