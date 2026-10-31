import { expect, test } from '../fixtures.js';
import { GitHubHttpError } from '../github/GitHubMock.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { SignInScreenHarness } from '../harnesses/SignInScreen.harness.js';
import { readStoredToken, signIn } from '../session.js';

test('signing out goes back to sign-in and forgets the token', async ({ page, github }) => {
    const shell = await signIn(page, github);

    await shell.signOut(SAMPLE_VIEWER.viewer.login);

    const signInScreen = new SignInScreenHarness(page);
    await expect(page).toHaveURL('/sign-in?next=/');
    await expect(signInScreen.signInButton).toBeVisible();
    await expect(signInScreen.notice).toBeHidden();
    expect(await readStoredToken(page)).toBeNull();
});

test('signing out in one tab signs out the others too', async ({ page, context, github }) => {
    const shell = await signIn(page, github);
    const otherTab = await context.newPage();
    await otherTab.goto('/');
    await expect(new AppShellHarness(otherTab).account(SAMPLE_VIEWER.viewer.login)).toBeVisible();

    await shell.signOut(SAMPLE_VIEWER.viewer.login);

    await expect(otherTab).toHaveURL('/sign-in?next=/');
    await expect(new SignInScreenHarness(otherTab).signInButton).toBeVisible();
});

test('a stored token GitHub no longer accepts signs out, saying why', async ({ page, github }) => {
    await signIn(page, github);

    github.graphql('Viewer', new GitHubHttpError(401, 'Bad credentials'));
    await page.reload();

    const signInScreen = new SignInScreenHarness(page);
    await expect(page).toHaveURL('/sign-in?next=/&failed=tokenRejected');
    await expect(signInScreen.notice).toContainText('You were signed out');
    expect(await readStoredToken(page)).toBeNull();
});
