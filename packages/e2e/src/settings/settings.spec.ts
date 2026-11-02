import { expect, test } from '../fixtures.js';
import { AccountScreenHarness } from '../harnesses/AccountScreen.harness.js';
import { MyWorkScreenHarness } from '../harnesses/MyWorkScreen.harness.js';
import { SettingsScreenHarness } from '../harnesses/SettingsScreen.harness.js';
import { TrackingScreenHarness } from '../harnesses/TrackingScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_PROJECT, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

test('`1` to `4` and the tabs switch the sections, kept in the address', async ({ page, github }) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    await expect(new MyWorkScreenHarness(page).groups.first()).toBeVisible();
    await page.keyboard.press(',');

    const settings = new SettingsScreenHarness(page);
    const tracking = new TrackingScreenHarness(page);
    const account = new AccountScreenHarness(page);
    await expect(settings.heading).toBeVisible();
    await expect(page).toHaveURL('/settings');
    await expect(settings.section('Repositories')).toHaveAttribute('aria-pressed', 'true');
    await expect(tracking.tracked(SAMPLE_REPOSITORY)).toBeVisible();

    await page.keyboard.press('2');
    await expect(page).toHaveURL('/settings?tab=projects');
    await expect(tracking.tracked(SAMPLE_PROJECT)).toBeVisible();

    await page.keyboard.press('3');
    await expect(page).toHaveURL('/settings?tab=saving');
    await expect(settings.section('Saving to GitHub')).toHaveAttribute('aria-pressed', 'true');
    await expect(tracking.search).toHaveCount(0);
    await expect(account.signOutButton).toHaveCount(0);

    await page.keyboard.press('4');
    await expect(page).toHaveURL('/settings?tab=account');
    await expect(account.signOutButton).toBeVisible();
    await expect(tracking.search).toHaveCount(0);
    await expect(tracking.ownerFilter).toHaveCount(0);

    await settings.section('Projects').click();
    await expect(page).toHaveURL('/settings?tab=projects');

    await page.keyboard.press('1');
    await expect(page).toHaveURL('/settings');

    // Only while Settings shows.
    await shell.myWorkLink('My work').click();
    await expect(page).toHaveURL('/');
    const myWork = new MyWorkScreenHarness(page);
    await expect(myWork.filter('All')).toBeVisible();

    // `4` is nothing here; `2` and `1` are My work's own, and show the keys before them were read.
    await page.keyboard.press('4');
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

test("tracking's old address lands on Settings with its section, and never hands off to github.com", async ({
    page,
    github,
}) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);

    await page.goto('/settings/tracking?tab=projects');
    await expect(new TrackingScreenHarness(page).tracked(SAMPLE_PROJECT)).toBeVisible();
    await expect(page).toHaveURL('/settings?tab=projects');

    await page.goto('/settings/tracking');
    await expect(new TrackingScreenHarness(page).tracked(SAMPLE_REPOSITORY)).toBeVisible();
    await expect(page).toHaveURL('/settings');
});

test('an unknown section shows the first', async ({ page, github }) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);

    await page.goto('/settings?tab=nope');
    await expect(new SettingsScreenHarness(page).section('Repositories')).toHaveAttribute('aria-pressed', 'true');
});
