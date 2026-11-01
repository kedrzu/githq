import { expect, test } from '../fixtures.js';
import { GitHubHttpError } from '../github/GitHubMock.js';
import { SAMPLE_TOKEN, SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { FirstSignInHarness } from '../harnesses/FirstSignIn.harness.js';
import { LandingHarness } from '../harnesses/Landing.harness.js';
import { readStoredToken, signIn } from '../session.js';

const LOGIN = SAMPLE_VIEWER.viewer.login;

/** Where the app keeps the signed-in user (`VIEWER_KEY` in `packages/app/auth/AuthStore.ts`). */
const VIEWER_KEY = 'githq.viewer';

test('signing out at home shows the landing page and forgets the token', async ({ page, github }) => {
    const shell = await signIn(page, github);

    await shell.signOut(LOGIN);

    const landing = new LandingHarness(page);
    await expect(page).toHaveURL('/');
    await expect(landing.signInButton).toBeVisible();
    await expect(landing.banner).toBeHidden();
    await expect(shell.account(LOGIN)).toBeHidden();
    expect(await readStoredToken(page)).toBeNull();
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

test('a token GitHub stops accepting while "my work" is open signs out to the landing page, saying why; dismissed, the banner stays away', async ({
    page,
    github,
}) => {
    await signIn(page, github);

    // With the user known, "my work" opens at once and GitHub is asked who they are behind it.
    github.graphql('Viewer', new GitHubHttpError(401, 'Bad credentials'));
    await page.reload();

    const landing = new LandingHarness(page);
    await expect(page).toHaveURL('/?failed=tokenRejected');
    await expect(landing.banner).toContainText('You were signed out.');
    expect(await readStoredToken(page)).toBeNull();

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
    github.graphql('Viewer', new GitHubHttpError(401, 'Bad credentials'));
    await page.goto('/pulls');

    const landing = new LandingHarness(page);
    await expect(page).toHaveURL('/?next=/pulls&failed=tokenRejected');
    await expect(landing.banner).toContainText('You were signed out.');
    expect(await readStoredToken(page)).toBeNull();
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
