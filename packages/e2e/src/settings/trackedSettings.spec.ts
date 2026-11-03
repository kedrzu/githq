import { expect, test } from '../fixtures.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { SettingsScreenHarness } from '../harnesses/SettingsScreen.harness.js';
import { TrackedSettingsScreenHarness } from '../harnesses/TrackedSettingsScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import {
    createSampleTrackedWork,
    SAMPLE_PROJECT,
    SAMPLE_PROJECT_PATH,
    SAMPLE_REPOSITORY,
} from '../tracking/sampleTrackedWork.js';

test("a tracked repository's settings open at GitHub's address of them, inside Settings, and Esc goes back", async ({
    page,
    github,
}) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    const settings = new SettingsScreenHarness(page);
    const screen = new TrackedSettingsScreenHarness(page);

    // Opened from its address: nothing to go back to in the app, so Esc goes to Repositories.
    await page.goto(`/${SAMPLE_REPOSITORY}/settings`);
    await expect(screen.heading(SAMPLE_REPOSITORY)).toBeVisible();
    await expect(settings.section('Repositories')).toHaveAttribute('aria-pressed', 'true');
    await expect(screen.trackingState).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL('/settings');

    // From the repository's menu: Esc goes back to where it was opened, and so does the head's way back.
    await shell.tracked(SAMPLE_REPOSITORY).click();
    // The repository's address opens its section (Issues the first time).
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/issues`);
    const repositoryUrl = page.url();
    const menu = await shell.openTrackedMenu(SAMPLE_REPOSITORY);
    await menu.getByRole('menuitem', { name: 'Settings' }).click();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/settings`);
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(repositoryUrl);

    await page.goForward();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/settings`);
    await screen.backButton('Repositories').click();
    await expect(page).toHaveURL(repositoryUrl);

    // A tab, or its key, goes to that section.
    await page.goForward();
    await expect(screen.heading(SAMPLE_REPOSITORY)).toBeVisible();
    await page.keyboard.press('2');
    await expect(page).toHaveURL('/settings?tab=projects');
});

test('Untrack is the same as on its row: back to Repositories, the toast offering Undo', async ({ page, github }) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    const screen = new TrackedSettingsScreenHarness(page);

    await page.goto(`/${SAMPLE_REPOSITORY}/settings`);
    await screen.untrackButton.click();
    await expect(page).toHaveURL('/settings');
    const toast = shell.toasts.filter({ hasText: `Stopped tracking ${SAMPLE_REPOSITORY}` });
    await expect(toast).toBeVisible();
    await expect(shell.tracked(SAMPLE_REPOSITORY)).toHaveCount(0);

    // Undo: tracked as ever, its settings open again.
    await toast.getByRole('button', { name: 'Undo' }).click();
    await expect(shell.tracked(SAMPLE_REPOSITORY)).toBeVisible();
    await page.goto(`/${SAMPLE_REPOSITORY}/settings`);
    await expect(screen.heading(SAMPLE_REPOSITORY)).toBeVisible();
});

test("a repository not tracked has no settings here: its address settles on Repositories; a tracked one's menu offers them", async ({
    page,
    github,
}) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);

    await page.goto('/acme/web/settings');
    await expect(page).toHaveURL('/settings');

    // A tracked one's view offers them in its title's menu, after "Copy link".
    await page.goto(`/${SAMPLE_REPOSITORY}`);
    const menu = await new RepositoryScreenHarness(page).openTitleMenu(SAMPLE_REPOSITORY);
    await expect(menu.getByRole('menuitem').filter({ hasText: /^(Copy link|Settings)/u })).toHaveText([
        /^Copy link/u,
        /^Settings/u,
    ]);
    await menu.getByRole('menuitem', { name: 'Settings' }).click();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/settings`);
});

test("a tracked project's settings open inside Settings with Projects chosen, and Esc goes to Projects", async ({
    page,
    github,
}) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    const settings = new SettingsScreenHarness(page);
    const screen = new TrackedSettingsScreenHarness(page);

    await page.goto(`${SAMPLE_PROJECT_PATH}/settings`);
    await expect(screen.heading(SAMPLE_PROJECT)).toBeVisible();
    await expect(settings.section('Projects')).toHaveAttribute('aria-pressed', 'true');
    await expect(screen.trackingState).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL('/settings?tab=projects');

    // From its menu in the sidebar.
    const menu = await shell.openTrackedMenu(SAMPLE_PROJECT);
    await menu.getByRole('menuitem', { name: 'Settings' }).click();
    await expect(page).toHaveURL(`${SAMPLE_PROJECT_PATH}/settings`);
    await screen.untrackButton.click();
    await expect(page).toHaveURL('/settings?tab=projects');
    await expect(shell.toasts.filter({ hasText: `Stopped tracking ${SAMPLE_PROJECT}` })).toBeVisible();

    // A project not tracked: its address settles on Projects.
    await page.goto('/orgs/acme/projects/9/settings');
    await expect(page).toHaveURL('/settings?tab=projects');
});
