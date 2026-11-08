import { createPromise } from '@nzyme/utils/createPromise.js';

import { expect, test } from '../fixtures.js';
import { SAMPLE_TOKEN, SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { FirstSignInHarness } from '../harnesses/FirstSignIn.harness.js';
import { LandingHarness } from '../harnesses/Landing.harness.js';
import { SavingScreenHarness } from '../harnesses/SavingScreen.harness.js';
import { E2E_CLIENT_ID } from '../localApp.js';
import { answerSettingsRepository, getSettingsWrites } from '../settings/answerSettingsRepository.js';

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

    await page.goto('/');
    await new LandingHarness(page).signInWithToken(SAMPLE_TOKEN);

    const choice = new FirstSignInHarness(page);
    await expect(page).toHaveURL('/settings/tracking/new');
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

test('"Track these" lands on My work at once, before any of the work is in, and the download goes on behind it; signed in again later, the app opens straight on the work', async ({
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

    await page.goto('/');
    await new LandingHarness(page).signInWithToken(SAMPLE_TOKEN);
    const firstSignIn = new FirstSignInHarness(page);
    await expect(firstSignIn.repository(`${LOGIN}/app`)).toBeChecked();
    await page.keyboard.press('ControlOrMeta+Enter');

    // On My work while GitHub still holds the user's work back; the tracked repository waits for its download, which
    // only the status bar tells (first run and loading D4) — the sidebar shows nothing where its count goes — and
    // which then goes on.
    const shell = new AppShellHarness(page);
    await expect(page).toHaveURL('/');
    const repository = shell.sidebar.getByRole('link', { name: new RegExp(`^${LOGIN}/app`) });
    await expect(repository.locator('span').last()).toHaveText('');
    await expect(shell.downloadProgress).toHaveText('Downloading · counting…');
    myWorkIn.resolve();
    repositoryIn.resolve();
    await expect(repository.locator('span').last()).toHaveText('0');
    await expect(shell.downloadProgress).toHaveCount(0);

    // The choice is kept in this browser: the app opens on the work, with no choosing step.
    await page.reload();
    await expect(page).toHaveURL('/');
    await expect(repository).toBeVisible();
});

test('the first sign-in tracks the own repositories and projects it chose: on My work at once, the sidebar counts their open items once they are in', async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    sample.world.install(github);
    github.graphql('Viewer', SAMPLE_VIEWER);

    await page.goto('/');
    await new LandingHarness(page).signInWithToken(SAMPLE_TOKEN);
    const firstSignIn = new FirstSignInHarness(page);
    await expect(firstSignIn.repository(SAMPLE_REPOSITORY)).toBeChecked();
    await expect(firstSignIn.project(SAMPLE_PROJECT)).toBeChecked();

    await firstSignIn.trackButton.click();

    const shell = new AppShellHarness(page);
    await expect(page).toHaveURL('/');
    // Open items: the repository's four, the project's five.
    await expect(shell.trackedCount(SAMPLE_REPOSITORY)).toHaveText('4');
    await expect(shell.trackedCount(SAMPLE_PROJECT)).toHaveText('5');

    await page.reload();
    await expect(page).toHaveURL('/');
    await expect(shell.trackedCount(SAMPLE_REPOSITORY)).toHaveText('4');
});

test("the choice's filter also searches GitHub: someone else's repository found there is ticked and tracked with the rest", async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    sample.world.repository('vitejs/vite', { description: 'Next generation frontend tooling' });
    sample.world.install(github);
    github.graphql('Viewer', SAMPLE_VIEWER);

    await page.goto('/');
    await new LandingHarness(page).signInWithToken(SAMPLE_TOKEN);
    const firstSignIn = new FirstSignInHarness(page);
    await expect(firstSignIn.repository(SAMPLE_REPOSITORY)).toBeChecked();

    await firstSignIn.root.getByRole('textbox', { name: 'Filter repositories' }).fill('vite');
    await expect(firstSignIn.root.getByRole('heading', { name: 'On GitHub' })).toBeVisible();
    await firstSignIn.repository('vitejs/vite').click();
    await expect(firstSignIn.repository('vitejs/vite')).toBeChecked();
    await firstSignIn.trackAndOpenMyWork();

    const shell = new AppShellHarness(page);
    await expect(shell.tracked('vitejs/vite')).toBeVisible();
    await expect(shell.tracked(SAMPLE_REPOSITORY)).toBeVisible();
});

/** A settings file tracking `acme/api` and nothing of the user's own. */
const SAVED_ELSEWHERE = {
    text: JSON.stringify({
        version: 1,
        repositories: [
            { nameWithOwner: 'acme/api', id: 'R_acme_api', tracking: true },
            { nameWithOwner: SAMPLE_REPOSITORY, id: 'R_octocat_app', tracking: false },
        ],
        projects: [],
    }),
    sha: 'saved',
};

test('settings saved on another device are offered instead of the choice: loaded, they are tracked, My work opens, saving goes on, and the choice is made', async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    sample.world.organization('acme');
    sample.world.repository('acme/api');
    sample.world.install(github);
    github.graphql('Viewer', SAMPLE_VIEWER);
    answerSettingsRepository(github, { exists: true, file: SAVED_ELSEWHERE });

    await page.goto('/');
    await new LandingHarness(page).signInWithToken(SAMPLE_TOKEN);
    const firstSignIn = new FirstSignInHarness(page);
    await expect(firstSignIn.root.getByRole('heading', { name: 'Load your saved settings?' })).toBeVisible();
    await expect(firstSignIn.root).toContainText(`in the private repository ${LOGIN}/githq-settings`);
    await expect(firstSignIn.root).toContainText('1 repository');
    await expect(firstSignIn.root).toContainText('acme/api');
    await expect(firstSignIn.root).not.toContainText(SAMPLE_REPOSITORY);

    await page.keyboard.press('ControlOrMeta+Enter');

    const shell = new AppShellHarness(page);
    await expect(page).toHaveURL('/');
    await expect(shell.tracked('acme/api')).toBeVisible();
    await expect(shell.tracked(SAMPLE_REPOSITORY)).toHaveCount(0);
    // Loaded as it was: nothing to write back, and nothing created.
    expect(getSettingsWrites(github)).toEqual([]);

    // The choice is made: the app opens on the work, and the settings stay synced.
    await page.reload();
    await expect(page).toHaveURL('/');
    await expect(shell.tracked('acme/api')).toBeVisible();
    await page.goto('/settings?tab=sync');
    await expect(new SavingScreenHarness(page).on).toBeVisible();
});

test('declining the saved settings leads to the choice, with no saving offered, and nothing is written', async ({
    page,
    github,
}) => {
    createSampleTrackedWork().world.install(github);
    github.graphql('Viewer', SAMPLE_VIEWER);
    answerSettingsRepository(github, { exists: true, file: SAVED_ELSEWHERE });

    await page.goto('/');
    await new LandingHarness(page).signInWithToken(SAMPLE_TOKEN);
    const firstSignIn = new FirstSignInHarness(page);
    await firstSignIn.root.getByRole('button', { name: "No, I'll choose here" }).click();

    await expect(firstSignIn.repository(SAMPLE_REPOSITORY)).toBeChecked();
    await expect(firstSignIn.root).toContainText(
        "Your saved settings weren't loaded, and saving stays off on this device. You can turn it on later in Settings.",
    );
    await expect(firstSignIn.savingChoice).toHaveCount(0);
    await firstSignIn.trackButton.click();
    await expect(page).toHaveURL('/');
    expect(getSettingsWrites(github)).toEqual([]);
});

test('a repository named githq-settings that isn’t githq’s says why nothing was loaded, offers no saving, and is never written to', async ({
    page,
    github,
}) => {
    createSampleTrackedWork().world.install(github);
    github.graphql('Viewer', SAMPLE_VIEWER);
    answerSettingsRepository(github, { exists: true, file: null, foreign: true });

    await page.goto('/');
    await new LandingHarness(page).signInWithToken(SAMPLE_TOKEN);
    const firstSignIn = new FirstSignInHarness(page);
    await expect(firstSignIn.root).toContainText(
        "You have a repository named githq-settings, but it doesn't hold githq's settings, so nothing was loaded and saving stays off.",
    );
    await expect(firstSignIn.savingChoice).toHaveCount(0);
    await firstSignIn.trackButton.click();
    await expect(page).toHaveURL('/');
    expect(getSettingsWrites(github)).toEqual([]);
});

test('saving is offered unticked; ticked, "Track these" creates the private repository and saves the choice in it', async ({
    page,
    github,
}) => {
    createSampleTrackedWork().world.install(github);
    github.graphql('Viewer', SAMPLE_VIEWER);
    const repository = answerSettingsRepository(github, { exists: false, file: null });

    await page.goto('/');
    await new LandingHarness(page).signInWithToken(SAMPLE_TOKEN);
    const firstSignIn = new FirstSignInHarness(page);
    await expect(firstSignIn.savingChoice).not.toBeChecked();
    await firstSignIn.savingChoice.click();
    await expect(firstSignIn.root).toContainText(`then creates ${LOGIN}/githq-settings`);
    // Nothing happens on GitHub until "Track these".
    expect(getSettingsWrites(github)).toEqual([]);

    await firstSignIn.trackButton.click();
    await expect(page).toHaveURL('/');
    await expect.poll(() => repository.file).not.toBeNull();
    expect(JSON.parse(repository.file?.text ?? 'null')).toMatchObject({
        version: 1,
        repositories: [{ nameWithOwner: SAMPLE_REPOSITORY, tracking: true }],
    });
    expect(github.restCalls.some(call => call.method === 'POST' && call.url.pathname === '/user/repos')).toBe(true);
});

test('left unticked, "Track these" creates nothing on GitHub', async ({ page, github }) => {
    createSampleTrackedWork().world.install(github);
    github.graphql('Viewer', SAMPLE_VIEWER);
    answerSettingsRepository(github, { exists: false, file: null });

    await page.goto('/');
    await new LandingHarness(page).signInWithToken(SAMPLE_TOKEN);
    const firstSignIn = new FirstSignInHarness(page);
    await expect(firstSignIn.savingChoice).not.toBeChecked();
    await firstSignIn.trackButton.click();
    await expect(page).toHaveURL('/');
    expect(getSettingsWrites(github)).toEqual([]);
});

test('"Track these" goes on once: pressed again while it does, nothing happens, and the repository is created once', async ({
    page,
    github,
}) => {
    createSampleTrackedWork().world.install(github);
    github.graphql('Viewer', SAMPLE_VIEWER);
    const repository = answerSettingsRepository(github, { exists: false, file: null });

    await page.goto('/');
    await new LandingHarness(page).signInWithToken(SAMPLE_TOKEN);
    const firstSignIn = new FirstSignInHarness(page);
    await firstSignIn.savingChoice.click();
    await expect(firstSignIn.root).toContainText(`then creates ${LOGIN}/githq-settings`);

    // The creation held unanswered — pressed again now, a second press would still find no repository and create
    // one — and the next step's code held back, so the page stays, going on.
    let creationsAsked = 0;
    const creationAsked = createPromise();
    const createdIn = createPromise();
    github.rest('POST', '/user/repos', async () => {
        creationsAsked++;
        creationAsked.resolve();
        await createdIn.promise;
        repository.exists = true;
        return { status: 201, json: { name: 'githq-settings' } };
    });
    const nextStepIn = createPromise();
    await page.route('**/_nuxt/**', async route => {
        await nextStepIn.promise;
        await route.fallback();
    });
    await firstSignIn.trackButton.click();
    await creationAsked.promise;
    await expect(firstSignIn.trackButton).toHaveAttribute('aria-busy', 'true');
    await page.keyboard.press('ControlOrMeta+Enter');
    nextStepIn.resolve();

    await expect(page).toHaveURL('/');
    createdIn.resolve();
    await expect.poll(() => repository.file).not.toBeNull();
    expect(creationsAsked).toBe(1);
});

test('"Only my repositories" does nothing while "Track these" looks at GitHub: what was chosen is what is tracked', async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    sample.world.organization('acme');
    sample.world.repository('acme/api');
    sample.world.install(github);
    github.graphql('Viewer', SAMPLE_VIEWER);
    const repository = answerSettingsRepository(github, { exists: false, file: null });

    await page.goto('/');
    await new LandingHarness(page).signInWithToken(SAMPLE_TOKEN);
    const firstSignIn = new FirstSignInHarness(page);
    await firstSignIn.savingChoice.click();
    await expect(firstSignIn.root).toContainText(`then creates ${LOGIN}/githq-settings`);
    await firstSignIn.repository('acme/api').check();

    // The look "Track these" takes first held back.
    const lookedIn = createPromise();
    github.rest('GET', `/repos/${LOGIN}/githq-settings`, async () => {
        await lookedIn.promise;
        return { status: 404, json: { message: 'Not Found' } };
    });
    await firstSignIn.trackButton.click();
    // Shown disabled, yet it keeps the focus and takes the press: the page ignores it.
    await expect(firstSignIn.onlyMineButton).toHaveAttribute('aria-disabled', 'true');
    await firstSignIn.onlyMineButton.focus();
    await page.keyboard.press('Enter');
    await expect(firstSignIn.onlyMineButton).toBeFocused();
    lookedIn.resolve();

    await expect(page).toHaveURL('/');
    await expect.poll(() => repository.file).not.toBeNull();
    expect(JSON.parse(repository.file?.text ?? 'null')).toMatchObject({
        repositories: [
            { nameWithOwner: SAMPLE_REPOSITORY, tracking: true },
            { nameWithOwner: 'acme/api', tracking: true },
        ],
    });
});

test('with the box ticked and GitHub out of reach, "Track these" stays and says so, the focus still on the box; pressed again once GitHub answers, it goes on and saves', async ({
    page,
    github,
}) => {
    createSampleTrackedWork().world.install(github);
    github.graphql('Viewer', SAMPLE_VIEWER);
    answerSettingsRepository(github, { exists: false, file: null });

    await page.goto('/');
    await new LandingHarness(page).signInWithToken(SAMPLE_TOKEN);
    const firstSignIn = new FirstSignInHarness(page);
    await firstSignIn.savingChoice.focus();
    await page.keyboard.press('Space');
    await expect(firstSignIn.root).toContainText(`then creates ${LOGIN}/githq-settings`);

    github.rest('GET', `/repos/${LOGIN}/githq-settings`, () => ({ status: 502, json: { message: 'Bad Gateway' } }));
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(firstSignIn.root.getByRole('alert')).toHaveText(
        "GitHub couldn't be reached, so nothing was saved yet. Press Track these to try again, or untick the box to go on without saving.",
    );
    await expect(page).toHaveURL(/\/settings\/tracking\/new/);
    await expect(firstSignIn.savingChoice).toBeChecked();
    await expect(firstSignIn.savingChoice).toBeFocused();
    expect(getSettingsWrites(github)).toEqual([]);

    const repository = answerSettingsRepository(github, { exists: false, file: null });
    await firstSignIn.trackButton.click();
    await expect(page).toHaveURL('/');
    await expect.poll(() => repository.file).not.toBeNull();
});
