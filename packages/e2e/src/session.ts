import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { parseOAuthCredentials } from '@githq/app/auth/utils/parseOAuthCredentials.js';
import type { OAuthCredentials } from '@githq/github/oauth.js';

import type { GitHubMock } from './github/GitHubMock.js';
import { SAMPLE_TOKEN, SAMPLE_VIEWER } from './github/sampleViewer.js';
import { AppShellHarness } from './harnesses/AppShell.harness.js';
import { FirstSignInHarness } from './harnesses/FirstSignIn.harness.js';
import { LandingHarness } from './harnesses/Landing.harness.js';
import { answerTrackingCandidates } from './tracking/answerTracking.js';

/** Where the app keeps the token (`TOKEN_KEY` in `packages/app/auth/TokenVault.ts`). */
const TOKEN_KEY = 'githq.token';

/**
 * Lets the app finish checking a token GitHub answered 401 for, in a session without a refresh token: it signs out only after checking again a few seconds
 * later (`REJECTION_RECHECK_DELAYS_MS` in `packages/app/auth/AuthStore.ts`), waits the page's clock skips. The clock
 * must be installed (`page.clock.install()`) before the page loads.
 */
export async function skipTokenRechecks(page: Page) {
    await expect(async () => {
        await page.clock.fastForward('00:20');
        expect(page.url()).toContain('failed=tokenRejected');
    }).toPass();
}

/** The credentials the app keeps in this browser, or `null` signed out; throws on anything else kept there. */
export async function readStoredCredentials(page: Page): Promise<OAuthCredentials | null> {
    const text = await page.evaluate(key => localStorage.getItem(key), TOKEN_KEY);
    const credentials = parseOAuthCredentials(text);
    if (text !== null && credentials === null) {
        throw new Error(`The app keeps something other than credentials under ${TOKEN_KEY}: ${text}`);
    }

    return credentials;
}

/**
 * Signs in as {@link SAMPLE_VIEWER} through the development sign-in, GitHub answering who it is, goes through
 * the first sign-in's choice with nothing to track (G10: the user has no repositories), and waits for the shell.
 */
export async function signIn(page: Page, github: GitHubMock): Promise<AppShellHarness> {
    github.graphql('Viewer', SAMPLE_VIEWER);
    answerTrackingCandidates(github, { login: SAMPLE_VIEWER.viewer.login });
    await page.goto('/');
    await new LandingHarness(page).signInWithToken(SAMPLE_TOKEN);
    await new FirstSignInHarness(page).continueButton.click();

    const shell = new AppShellHarness(page);
    await expect(shell.account(SAMPLE_VIEWER.viewer.login)).toBeVisible();
    return shell;
}
