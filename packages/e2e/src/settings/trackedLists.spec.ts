import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { expect, test } from '../fixtures.js';
import { TrackedListScreenHarness } from '../harnesses/TrackedListScreen.harness.js';
import { TrackedSettingsScreenHarness } from '../harnesses/TrackedSettingsScreen.harness.js';
import { TrackingScreenHarness } from '../harnesses/TrackingScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import {
    createSampleTrackedWork,
    SAMPLE_PROJECT,
    SAMPLE_PROJECT_PATH,
    SAMPLE_REPOSITORY,
} from '../tracking/sampleTrackedWork.js';

const LOGIN = SAMPLE_VIEWER.viewer.login;
const REPOSITORY_NAME = SAMPLE_REPOSITORY.split('/')[1] ?? '';

test("Repositories lists what is tracked by owner; ⌫ untracks the selected row and the toast's Undo brings it back", async ({
    page,
    github,
}) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/settings');

    const list = new TrackedListScreenHarness(page);
    await expect(list.heading).toHaveText(/^1\stracked\srepository$/u);
    await expect(list.groupHeader(LOGIN)).toHaveText(/your\srepositories\s·\s1\sof\s1\stracked$/u);
    const row = list.row(LOGIN, REPOSITORY_NAME);
    await expect(row).toHaveText(/\d+\sopen/u);

    await page.keyboard.press('j');
    await expect(list.selectedRow).toHaveText(new RegExp(`^${REPOSITORY_NAME}`, 'u'));
    await page.keyboard.press('Backspace');

    await expect(row).toHaveCount(0);
    await expect(list.heading).toHaveText(/^0\stracked\srepositories$/u);
    const toast = shell.toasts.filter({ hasText: `Stopped tracking ${SAMPLE_REPOSITORY}` });
    await expect(toast).toBeVisible();

    await toast.getByRole('button', { name: 'Undo' }).click();
    await expect(row).toBeVisible();
    await expect(list.heading).toHaveText(/^1\stracked\srepository$/u);
});

test("Enter on a row opens the repository's settings, and Esc returns to the list", async ({ page, github }) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    await page.goto('/settings');

    const list = new TrackedListScreenHarness(page);
    await expect(list.row(LOGIN, REPOSITORY_NAME)).toBeVisible();
    await page.keyboard.press('j');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/settings`);
    await expect(new TrackedSettingsScreenHarness(page).heading(SAMPLE_REPOSITORY)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL('/settings');
    await expect(list.row(LOGIN, REPOSITORY_NAME)).toBeVisible();

    // A click opens it too.
    await list.row(LOGIN, REPOSITORY_NAME).click();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/settings`);
});

test('A opens the picker, and tracking a repository there adds its row', async ({ page, github }) => {
    const { world } = createSampleTrackedWork();
    await openTrackedWork(page, github, world);
    // Created after the first sign-in chose what to track: not tracked.
    world.repository(`${LOGIN}/docs`);
    await page.goto('/settings');

    const list = new TrackedListScreenHarness(page);
    await expect(list.row(LOGIN, REPOSITORY_NAME)).toBeVisible();
    await expect(list.groupHeader(LOGIN)).toHaveText(/your\srepositories\s·\s1\sof\s2\stracked\s*Track\smore$/u);
    await page.keyboard.press('a');

    const picker = new TrackingScreenHarness(page);
    await expect(picker.dialog).toBeVisible();
    await picker.track(`${LOGIN}/docs`);

    await expect(list.row(LOGIN, 'docs')).toBeVisible();
    await expect(list.heading).toHaveText(/^2\stracked\srepositories$/u);
    // All of the user's own tracked: nothing more to track of them.
    await expect(list.groupHeader(LOGIN)).toHaveText(/your\srepositories\s·\s2\sof\s2\stracked$/u);
});

test("Projects says where a project's items come from and how many it holds; Enter opens its settings", async ({
    page,
    github,
}) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    await page.goto('/settings?tab=projects');

    const list = new TrackedListScreenHarness(page);
    await expect(list.heading).toHaveText(/^1\stracked\sproject$/u);
    await expect(list.groupHeader(LOGIN)).toHaveText(/your\sprojects\s·\s1\sof\s1\stracked$/u);
    // Its own repository's issue, three of the untracked acme/web's and a draft; the archived one left out.
    await expect(list.row(LOGIN, SAMPLE_PROJECT)).toHaveText(/#1\s*from\s2\srepositories,\s1\stracked\s*5\sitems/u);

    await page.keyboard.press('j');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${SAMPLE_PROJECT_PATH}/settings`);
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL('/settings?tab=projects');
});
