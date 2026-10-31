import { OAUTH_CALLBACK_PATH, OAUTH_SCOPES } from '@githq/github/oauth.js';
import { createPromise } from '@nzyme/utils/createPromise.js';

import { expect, test } from '../fixtures.js';
import { GitHubHttpError } from '../github/GitHubMock.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { SAMPLE_TOKEN, SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { SignInScreenHarness } from '../harnesses/SignInScreen.harness.js';
import { FirstSignInHarness } from '../harnesses/FirstSignIn.harness.js';
import { E2E_BASE_URL, E2E_CLIENT_ID } from '../localApp.js';
import { readStoredToken } from '../session.js';
import { answerTrackingCandidates } from '../tracking/answerTracking.js';

const LOGIN = SAMPLE_VIEWER.viewer.login;

test('signed out, the app opens on sign-in, saying what GitHub will ask for', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/sign-in?next=/');
    const signIn = new SignInScreenHarness(page);
    await expect(signIn.permissions).toBeVisible();
    await expect(signIn.signInButton).toBeVisible();
    await expect(signIn.notice).toBeHidden();
});

test('"Sign in with GitHub" asks GitHub for the scopes, and a cancel on GitHub comes back explained', async ({
    page,
    github,
}) => {
    const authorize = answerAuthorize(github, state => ({ error: 'access_denied', state }));
    await page.goto('/sign-in');
    await new SignInScreenHarness(page).signInButton.click();

    const query = (await authorize).searchParams;
    expect(query.get('client_id')).toBe(E2E_CLIENT_ID);
    expect(query.get('scope')).toBe(OAUTH_SCOPES.join(' '));
    expect(query.get('redirect_uri')).toBe(`${E2E_BASE_URL}${OAUTH_CALLBACK_PATH}`);
    expect(query.get('state')).toMatch(/^[\w-]{43}$/);

    const signIn = new SignInScreenHarness(page);
    await expect(page).toHaveURL('/sign-in?failed=cancelled');
    await expect(signIn.notice).toContainText("Sign-in didn't finish");
    await expect(signIn.notice).toContainText("Access was cancelled on GitHub's screen");
    expect(await readStoredToken(page)).toBeNull();

    // The reason is in the address, so a reload still explains it.
    await page.reload();
    await expect(signIn.notice).toContainText("Access was cancelled on GitHub's screen");
});

test('a return from GitHub with a state this tab did not issue fails without signing in', async ({ page, github }) => {
    // The code is never exchanged: the token exchange is not mocked, so a call to it would fail the test.
    const authorize = answerAuthorize(github, () => ({ code: 'e2e-code', state: 'not-the-state-this-tab-sent' }));
    await page.goto('/sign-in');
    await new SignInScreenHarness(page).signInButton.click();
    await authorize;

    const signIn = new SignInScreenHarness(page);
    await expect(page).toHaveURL('/sign-in?failed=failed');
    await expect(signIn.notice).toContainText('Something went wrong on the way back from GitHub');
    expect(await readStoredToken(page)).toBeNull();
});

test('signing in with GitHub ends in the app, where the user was heading', async ({ page, github }) => {
    const authorize = answerAuthorize(github, state => ({ code: 'e2e-code', state }));
    github.tokenExchange({ accessToken: SAMPLE_TOKEN, scopes: OAUTH_SCOPES });
    github.graphql('Viewer', SAMPLE_VIEWER);
    answerTrackingCandidates(github, { login: LOGIN });

    await page.goto('/sign-in?next=/somewhere');
    await new SignInScreenHarness(page).signInButton.click();
    await authorize;

    // The first sign-in chooses what to track first (here nothing: the user has no repositories). `/somewhere` is
    // no screen of the app, so it then opens "My work".
    await expect(page).toHaveURL('/welcome');
    await new FirstSignInHarness(page).continueButton.click();
    await expect(new AppShellHarness(page).account(LOGIN)).toBeVisible();
    await expect(page).toHaveURL('/');
    expect(await readStoredToken(page)).toBe(SAMPLE_TOKEN);
});

test('signed in with a token, the shell shows the user and the allowance, and opens at once on reload', async ({
    page,
    github,
}) => {
    github.graphql('Viewer', ({ token }) =>
        token === SAMPLE_TOKEN ? SAMPLE_VIEWER : new GitHubHttpError(401, 'Bad credentials'),
    );
    answerTrackingCandidates(github, { login: LOGIN });
    await page.goto('/sign-in');
    await new SignInScreenHarness(page).signInWithToken(SAMPLE_TOKEN);
    await new FirstSignInHarness(page).continueButton.click();

    const shell = new AppShellHarness(page);
    await expect(page).toHaveURL('/');
    await expect(shell.account(LOGIN)).toContainText(LOGIN);
    await expect(shell.account(LOGIN).locator('img')).toHaveJSProperty('naturalWidth', 1);
    await expect(shell.statusBar).toContainText('4,812 of 5,000 left this hour');

    // After a reload GitHub is asked who the user is again; the shell does not wait for the answer.
    const answer = createPromise();
    github.graphql('Viewer', async () => {
        await answer.promise;
        return SAMPLE_VIEWER;
    });
    github.rateLimit = { ...github.rateLimit, remaining: 4811 };
    await page.reload();

    await expect(shell.account(LOGIN)).toBeVisible();
    await expect(shell.statusBar).not.toContainText('left this hour');
    answer.resolve();
    await expect(shell.statusBar).toContainText('4,811 of 5,000 left this hour');
});

/**
 * Answers GitHub's consent screen (`github.com/login/oauth/authorize`) by sending the browser back to the
 * app's callback with `callbackQuery` (given the `state` GitHub was sent); resolves with the screen's address.
 */
function answerAuthorize(github: GitHubMock, callbackQuery: (state: string) => Record<string, string>) {
    const opened = createPromise<URL>();
    github.web('/login/oauth/authorize', url => {
        opened.resolve(url);
        const callback = new URL(OAUTH_CALLBACK_PATH, E2E_BASE_URL);
        callback.search = new URLSearchParams(callbackQuery(url.searchParams.get('state') ?? '')).toString();
        return { status: 302, headers: { location: callback.href } };
    });

    return opened.promise;
}
