import { stringifyOAuthCredentials } from '@githq/app/auth/utils/stringifyOAuthCredentials.js';
import { OAUTH_SCOPES } from '@githq/github/oauth.js';
import type { OAuthCredentials } from '@githq/github/oauth.js';

import { expect, test } from '../fixtures.js';
import { GitHubHttpError } from '../github/GitHubMock.js';
import {
    SAMPLE_REFRESH_TOKEN,
    SAMPLE_TOKEN,
    SAMPLE_TOKEN_LIFETIME_SECONDS,
    SAMPLE_VIEWER,
} from '../github/sampleViewer.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { FirstSignInHarness } from '../harnesses/FirstSignIn.harness.js';
import { LandingHarness } from '../harnesses/Landing.harness.js';
import { readStoredCredentials, signIn, skipTokenRechecks } from '../session.js';

const LOGIN = SAMPLE_VIEWER.viewer.login;

/** Where the app keeps the signed-in user (`VIEWER_KEY` in `packages/app/auth/AuthStore.ts`). */
const VIEWER_KEY = 'githq.viewer';
/** Where the app keeps the credentials (`TOKEN_KEY` in `packages/app/auth/TokenVault.ts`). */
const TOKEN_KEY = 'githq.token';
test('signing out at home shows the landing page, forgets the token and revokes it at GitHub', async ({
    page,
    github,
}) => {
    const shell = await signIn(page, github);

    await shell.signOut(LOGIN);
    await expect.poll(() => github.revokedTokens).toEqual([SAMPLE_TOKEN]);

    const landing = new LandingHarness(page);
    await expect(page).toHaveURL('/');
    await expect(landing.signInButton).toBeVisible();
    await expect(landing.banner).toBeHidden();
    await expect(shell.account(LOGIN)).toBeHidden();
    expect(await readStoredCredentials(page)).toBeNull();
});

test('signing out in one tab signs out the others too', async ({ page, context, github }) => {
    const shell = await signIn(page, github);
    const otherTab = await context.newPage();
    await otherTab.goto('/');
    await expect(new AppShellHarness(otherTab).account(LOGIN)).toBeVisible();

    await shell.signOut(LOGIN);

    await expect(otherTab).toHaveURL('/');
    await expect(new LandingHarness(otherTab).signInButton).toBeVisible();
});

test('a token GitHub rejects while the app is still starting on a slow device signs out to the banner, not an error page', async ({
    page,
    github,
}) => {
    await signIn(page, github);

    // Slowed down, GitHub's answer arrives while the route guard of the first navigation is still waiting.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 8 });
    await page.clock.install();
    github.graphql('Viewer', new GitHubHttpError(401, 'Bad credentials'));
    await page.reload();
    await skipTokenRechecks(page);

    const landing = new LandingHarness(page);
    await expect(page).toHaveURL('/?failed=tokenRejected');
    await expect(landing.banner).toContainText('You were signed out.', { timeout: 15_000 });
});

test('a token GitHub stops accepting while "my work" is open signs out to the landing page, saying why; dismissed, the banner stays away', async ({
    page,
    github,
}) => {
    await signIn(page, github);

    // With the user known, "my work" opens at once and GitHub is asked who they are behind it.
    await page.clock.install();
    github.graphql('Viewer', new GitHubHttpError(401, 'Bad credentials'));
    await page.reload();
    await skipTokenRechecks(page);

    const landing = new LandingHarness(page);
    await expect(page).toHaveURL('/?failed=tokenRejected');
    await expect(landing.banner).toContainText('You were signed out.');
    expect(await readStoredCredentials(page)).toBeNull();

    await landing.dismissButton.click();
    await expect(landing.banner).toBeHidden();
    await expect(page).toHaveURL('/');
    await page.reload();
    await expect(landing.signInButton).toBeVisible();
    await expect(landing.banner).toBeHidden();
});

test('a token GitHub no longer accepts at app start lands on the landing page, saying why', async ({
    page,
    github,
}) => {
    await signIn(page, github);

    // The user not known yet, the app waits for GitHub before opening anything.
    await page.evaluate(key => localStorage.removeItem(key), VIEWER_KEY);
    await page.clock.install();
    github.graphql('Viewer', new GitHubHttpError(401, 'Bad credentials'));
    await page.goto('/pulls');
    await skipTokenRechecks(page);

    const landing = new LandingHarness(page);
    await expect(page).toHaveURL('/?next=/pulls&failed=tokenRejected');
    await expect(landing.banner).toContainText('You were signed out.');
    expect(await readStoredCredentials(page)).toBeNull();
});

test('a token GitHub stops accepting is renewed with its refresh token through the Worker, and the session goes on with the new one', async ({
    page,
    github,
}) => {
    await signIn(page, github);
    // Signed in as GitHub's OAuth App signs in now: an access token that expires, and the refresh token that renews it.
    const signedIn: OAuthCredentials = {
        accessToken: SAMPLE_TOKEN,
        refreshToken: SAMPLE_REFRESH_TOKEN,
        expiresAt: Date.now() + SAMPLE_TOKEN_LIFETIME_SECONDS * 1000,
    };
    await page.evaluate(([key, text]) => localStorage.setItem(key, text), [
        TOKEN_KEY,
        stringifyOAuthCredentials(signedIn),
    ] as const);

    // GitHub no longer accepts the first token (expired, say), only the one the refresh token renews it with.
    const renewedToken = 'gho_e2eRenewedToken';
    const renewedRefreshToken = 'ghr_e2eRenewedRefreshToken';
    const viewerTokens: (string | null)[] = [];
    github.graphql('Viewer', ({ token }) => {
        viewerTokens.push(token);
        return token === renewedToken ? SAMPLE_VIEWER : new GitHubHttpError(401, 'Bad credentials');
    });
    github.tokenRefresh(SAMPLE_REFRESH_TOKEN, {
        accessToken: renewedToken,
        refreshToken: renewedRefreshToken,
        expiresIn: SAMPLE_TOKEN_LIFETIME_SECONDS,
        scopes: OAUTH_SCOPES,
    });
    await page.reload();

    await expect.poll(() => github.refreshBodies).toEqual([{ refreshToken: SAMPLE_REFRESH_TOKEN }]);
    await expect.poll(() => viewerTokens).toEqual([SAMPLE_TOKEN, renewedToken]);
    const stored = await readStoredCredentials(page);
    expect(stored?.accessToken).toBe(renewedToken);
    expect(stored?.refreshToken).toBe(renewedRefreshToken);
    await expect(page).toHaveURL('/');
    await expect(new AppShellHarness(page).account(LOGIN)).toBeVisible();
    await expect(new LandingHarness(page).signInButton).toBeHidden();
});

test('signed out, an app address opens the landing page, and signing in there returns to it', async ({
    page,
    github,
}) => {
    const shell = await signIn(page, github);
    await shell.signOut(LOGIN);
    await expect(page).toHaveURL('/');

    await page.goto('/settings');
    const landing = new LandingHarness(page);
    await expect(landing.signInButton).toBeVisible();
    await expect(page).toHaveURL('/?next=/settings');

    // Signed out, this browser's copy of the user's work is gone: what to track is chosen again first.
    await landing.signInWithToken(SAMPLE_TOKEN);
    await expect(page).toHaveURL('/settings/tracking/new?next=/settings');
    await new FirstSignInHarness(page).continueButton.click();
    await expect(page).toHaveURL('/settings');
    await expect(shell.account(LOGIN)).toBeVisible();
});
