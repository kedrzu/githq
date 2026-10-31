import { createPromise } from '@nzyme/utils/createPromise.js';

import { expect, test } from '../fixtures.js';
import { SAMPLE_TOKEN, SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { FirstSignInHarness } from '../harnesses/FirstSignIn.harness.js';
import { SignInScreenHarness } from '../harnesses/SignInScreen.harness.js';
import { E2E_CLIENT_ID } from '../localApp.js';

import { answerEmptyRepositories, answerTrackingCandidates } from './answerTracking.js';
import { createSampleTrackedWork, SAMPLE_PROJECT, SAMPLE_REPOSITORY } from './sampleTrackedWork.js';

const LOGIN = SAMPLE_VIEWER.viewer.login;

test('a first sign-in chooses what to track: the own repositories chosen, not the organisation’s, and an organisation hiding its private ones says why and how to ask', async ({
    page,
    github,
}) => {
    github.graphql('Viewer', SAMPLE_VIEWER);
    answerTrackingCandidates(github, {
        login: LOGIN,
        repositories: [
            { nameWithOwner: `${LOGIN}/app`, minutesAgo: 12 },
            { nameWithOwner: `${LOGIN}/old`, isArchived: true },
        ],
        organizations: [{ login: 'acme', repositories: [{ nameWithOwner: 'acme/api', isPrivate: true }] }],
        hidingOrganizations: ['secretive'],
    });
    const approvalPage = `/settings/connections/applications/${E2E_CLIENT_ID}`;
    github.web(approvalPage, () => ({
        status: 200,
        headers: { 'content-type': 'text/html' },
        body: "githq's OAuth App on GitHub",
    }));

    await page.goto('/sign-in');
    await new SignInScreenHarness(page).signInWithToken(SAMPLE_TOKEN);

    const choice = new FirstSignInHarness(page);
    await expect(page).toHaveURL('/welcome');
    await expect(choice.repository(`${LOGIN}/app`)).toBeChecked();
    // Archived: read-only, not chosen for the user.
    await expect(choice.repository(`${LOGIN}/old`)).not.toBeChecked();
    await expect(choice.repository('acme/api')).not.toBeChecked();

    await expect(choice.root).toContainText(
        "secretive hasn't approved githq, so its private repositories can't be listed.",
    );
    await choice.root.getByRole('button', { name: 'Why, and how to fix' }).click();
    await expect(
        choice.root.getByRole('region', { name: 'secretive hides its private data from githq' }),
    ).toBeVisible();

    // GitHub's page of the OAuth App, where the approval is requested, through the Worker.
    const popup = page.waitForEvent('popup');
    await choice.requestApprovalLink.click();
    await expect((await popup).locator('body')).toHaveText("githq's OAuth App on GitHub");
    await expect(choice.root).toContainText("You opened GitHub's page to request approval on");
});

test('"Track these" goes on to the first download: My work opens as soon as it is in, and the download goes on behind it; signed in again later, the app opens straight on the work', async ({
    page,
    github,
}) => {
    const myWorkIn = createPromise();
    github.searchIssues = async () => {
        await myWorkIn.promise;
        return [];
    };
    const repositoryIn = createPromise();
    answerEmptyRepositories(github, [`${LOGIN}/app`], repositoryIn.promise);
    github.graphql('Viewer', SAMPLE_VIEWER);
    answerTrackingCandidates(github, {
        login: LOGIN,
        repositories: [{ nameWithOwner: `${LOGIN}/app` }],
        organizations: [{ login: 'acme', repositories: [{ nameWithOwner: 'acme/api' }] }],
    });

    await page.goto('/sign-in');
    await new SignInScreenHarness(page).signInWithToken(SAMPLE_TOKEN);
    const firstSignIn = new FirstSignInHarness(page);
    await expect(firstSignIn.repository(`${LOGIN}/app`)).toBeChecked();
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(page).toHaveURL('/welcome/download');
    await expect(firstSignIn.openMyWorkButton).toBeDisabled();
    myWorkIn.resolve();
    await expect(firstSignIn.openMyWorkButton).toBeEnabled();
    await expect(firstSignIn.root).toContainText('Your work is ready');
    await firstSignIn.openMyWorkButton.click();

    // On My work, the tracked repository still waits for its download, which then goes on.
    const shell = new AppShellHarness(page);
    await expect(page).toHaveURL('/');
    const repository = shell.sidebar.getByRole('link', { name: new RegExp(`^${LOGIN}/app`) });
    await expect(repository.locator('span').last()).toHaveText('waiting');
    repositoryIn.resolve();
    await expect(repository.locator('span').last()).toHaveText('0');

    // The choice is kept in this browser: the app opens on the work, with no choosing or download step.
    await page.reload();
    await expect(page).toHaveURL('/');
    await expect(repository).toBeVisible();
});

test('the first sign-in tracks the own repositories and projects it chose: their download shows its progress, and once it is done the sidebar counts their open items', async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    sample.world.organization('acme');
    sample.world.repository('acme/api');
    sample.world.organization('secretive', { hidesPrivateData: true });
    sample.world.repository('secretive/docs');
    sample.world.install(github);
    github.graphql('Viewer', SAMPLE_VIEWER);

    await page.goto('/sign-in');
    await new SignInScreenHarness(page).signInWithToken(SAMPLE_TOKEN);
    const firstSignIn = new FirstSignInHarness(page);
    await expect(firstSignIn.repository(SAMPLE_REPOSITORY)).toBeChecked();
    await expect(firstSignIn.project(SAMPLE_PROJECT)).toBeChecked();
    await expect(firstSignIn.repository('acme/api')).not.toBeChecked();
    await expect(firstSignIn.root).toContainText(
        "secretive hasn't approved githq, so its private repositories can't be listed.",
    );

    await firstSignIn.trackButton.click();
    await expect(page).toHaveURL('/welcome/download');
    // Every item of the repository — the closed one too — and of the project, archived ones left out.
    await expect(firstSignIn.progress(SAMPLE_REPOSITORY)).toContainText('5 items');
    await expect(firstSignIn.progress(SAMPLE_REPOSITORY)).toContainText('Done');
    await expect(firstSignIn.progress(SAMPLE_PROJECT)).toContainText('Done');
    await expect(firstSignIn.root).toContainText('Everything is here.');
    await expect(firstSignIn.root).toContainText('Your work is ready');
    await firstSignIn.openMyWorkButton.click();

    const shell = new AppShellHarness(page);
    await expect(page).toHaveURL('/');
    // Open items: the repository's four, the project's five.
    await expect(shell.trackedCount(SAMPLE_REPOSITORY)).toHaveText('4');
    await expect(shell.trackedCount(SAMPLE_PROJECT)).toHaveText('5');

    await page.reload();
    await expect(page).toHaveURL('/');
    await expect(shell.trackedCount(SAMPLE_REPOSITORY)).toHaveText('4');
});
