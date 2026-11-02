import { expect, test } from '../fixtures.js';
import { AccountScreenHarness } from '../harnesses/AccountScreen.harness.js';
import { MyWorkScreenHarness } from '../harnesses/MyWorkScreen.harness.js';
import { SavingScreenHarness } from '../harnesses/SavingScreen.harness.js';
import { SettingsScreenHarness } from '../harnesses/SettingsScreen.harness.js';
import { TrackingScreenHarness } from '../harnesses/TrackingScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_PROJECT, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

test('`1` to `3` and the tabs switch the sections, kept in the address', async ({ page, github }) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    await expect(new MyWorkScreenHarness(page).groups.first()).toBeVisible();
    await page.keyboard.press(',');

    const settings = new SettingsScreenHarness(page);
    const tracking = new TrackingScreenHarness(page);
    const saving = new SavingScreenHarness(page);
    const account = new AccountScreenHarness(page);
    await expect(settings.heading).toBeVisible();
    await expect(page).toHaveURL('/settings');
    await expect(settings.section('What to track')).toHaveAttribute('aria-pressed', 'true');
    await expect(tracking.row(SAMPLE_REPOSITORY)).toBeChecked();
    await expect(tracking.row(SAMPLE_PROJECT)).toBeChecked();

    await page.keyboard.press('2');
    await expect(page).toHaveURL('/settings?tab=sync');
    await expect(settings.section('Sync settings')).toHaveAttribute('aria-pressed', 'true');
    await expect(saving.choice).toBeVisible();
    await expect(tracking.search).toHaveCount(0);
    await expect(account.signOutButton).toHaveCount(0);

    await page.keyboard.press('3');
    await expect(page).toHaveURL('/settings?tab=account');
    await expect(account.signOutButton).toBeVisible();
    await expect(tracking.search).toHaveCount(0);
    await expect(saving.choice).toHaveCount(0);

    await settings.section('Sync settings').click();
    await expect(page).toHaveURL('/settings?tab=sync');

    await page.keyboard.press('1');
    await expect(page).toHaveURL('/settings');
    await expect(tracking.row(SAMPLE_REPOSITORY)).toBeChecked();

    // Only while Settings shows.
    await shell.myWorkLink('My work').click();
    await expect(page).toHaveURL('/');
    const myWork = new MyWorkScreenHarness(page);
    await expect(myWork.filter('All')).toBeVisible();

    // `3` is nothing here; `2` and `1` are My work's own, and show the keys before them were read.
    await page.keyboard.press('3');
    await page.keyboard.press('2');
    await expect(myWork.filter('Needs me')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('1');
    await expect(myWork.filter('All')).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL('/');
});

test('a key pressed in an open menu stays with the menu', async ({ page, github }) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    await expect(new MyWorkScreenHarness(page).groups.first()).toBeVisible();

    await shell.account('octocat').click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press(',');

    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page).toHaveURL('/');
});

test('typing a digit in the search field is typing, not switching the section', async ({ page, github }) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    await page.goto('/settings');

    const tracking = new TrackingScreenHarness(page);
    await tracking.search.click();
    await page.keyboard.type('24');

    await expect(tracking.search).toHaveValue('24');
    await expect(page).toHaveURL('/settings');
});

test("tracking's old addresses land on Settings' first section, and never hand off to github.com", async ({
    page,
    github,
}) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);

    await page.goto('/settings/tracking?tab=projects');
    await expect(new TrackingScreenHarness(page).row(SAMPLE_PROJECT)).toBeChecked();
    await expect(page).toHaveURL('/settings?tab=projects');
    await expect(new SettingsScreenHarness(page).section('What to track')).toHaveAttribute('aria-pressed', 'true');

    await page.goto('/settings/tracking');
    await expect(new TrackingScreenHarness(page).row(SAMPLE_REPOSITORY)).toBeChecked();
    await expect(page).toHaveURL('/settings');
});

test('an unknown section, or one of the old ones, shows the first', async ({ page, github }) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    const settings = new SettingsScreenHarness(page);

    for (const tab of ['nope', 'repositories', 'projects', 'saving']) {
        await page.goto(`/settings?tab=${tab}`);
        await expect(settings.section('What to track')).toHaveAttribute('aria-pressed', 'true');
    }
});

test('What to track scrolls a long list, the bar of staged changes staying in view', async ({ page, github }) => {
    const { world } = createSampleTrackedWork();
    const owner = SAMPLE_REPOSITORY.split('/')[0] ?? '';
    for (let index = 1; index <= 40; index++) {
        world.repository(`${owner}/tool-${index}`);
    }

    await openTrackedWork(page, github, world);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/settings');

    const tracking = new TrackingScreenHarness(page);
    await tracking.owner(owner).click();
    const last = tracking.row(`${owner}/tool-40`);
    await expect(last).toBeAttached();
    await expect(last).not.toBeInViewport();

    await tracking.row(SAMPLE_REPOSITORY).uncheck();
    await tracking.row(SAMPLE_REPOSITORY).hover();
    await page.mouse.wheel(0, 5000);
    await expect(last).toBeInViewport({ ratio: 1 });
    await expect(tracking.pending).toBeInViewport({ ratio: 1 });
});
