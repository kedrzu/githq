import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import type { GitHubMock } from './github/GitHubMock.js';
import { SAMPLE_TOKEN, SAMPLE_VIEWER } from './github/sampleViewer.js';
import { AppShellHarness } from './harnesses/AppShell.harness.js';
import { FirstSignInHarness } from './harnesses/FirstSignIn.harness.js';
import { SignInScreenHarness } from './harnesses/SignInScreen.harness.js';
import { answerTrackingCandidates } from './tracking/answerTracking.js';

/** Where the app keeps the token (`TOKEN_KEY` in `packages/app/auth/AuthStore.ts`). */
const TOKEN_KEY = 'githq.token';

/** The token the app keeps in this browser, or `null` signed out. */
export async function readStoredToken(page: Page): Promise<string | null> {
    return await page.evaluate(key => localStorage.getItem(key), TOKEN_KEY);
}

/**
 * Signs in as {@link SAMPLE_VIEWER} through the development sign-in, GitHub answering who it is, goes through
 * the first sign-in's choice with nothing to track (G10: the user has no repositories), and waits for the shell.
 */
export async function signIn(page: Page, github: GitHubMock): Promise<AppShellHarness> {
    github.graphql('Viewer', SAMPLE_VIEWER);
    answerTrackingCandidates(github, { login: SAMPLE_VIEWER.viewer.login });
    await page.goto('/sign-in');
    await new SignInScreenHarness(page).signInWithToken(SAMPLE_TOKEN);
    await new FirstSignInHarness(page).continueButton.click();

    const shell = new AppShellHarness(page);
    await expect(shell.account(SAMPLE_VIEWER.viewer.login)).toBeVisible();
    return shell;
}
