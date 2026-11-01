import { expect, test } from '../fixtures.js';
import { MyWorkScreenHarness } from '../harnesses/MyWorkScreen.harness.js';
import { ProjectScreenHarness } from '../harnesses/ProjectScreen.harness.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { TrackingScreenHarness } from '../harnesses/TrackingScreen.harness.js';

import { openTrackedWork } from './openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_PROJECT, SAMPLE_REPOSITORY } from './sampleTrackedWork.js';

test('untracking a repository drops its items that nothing else keeps: those in My work or in a tracked project stay', async ({
    page,
    github,
}) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    await page.goto('/settings');

    const tracking = new TrackingScreenHarness(page);
    await tracking.untrack(SAMPLE_REPOSITORY);
    await expect(tracking.tracked(SAMPLE_REPOSITORY)).toHaveCount(0);
    await expect(shell.tracked(SAMPLE_REPOSITORY)).toHaveCount(0);

    // Assigned to the user, the issue stays in My work.
    await shell.myWorkLink('My work').click();
    await expect(new MyWorkScreenHarness(page).rows('Assigned to me')).toHaveText([/Crash on start/]);

    // Kept: the issue of My work, and the one the tracked project holds; the others are gone.
    const repository = new RepositoryScreenHarness(page);
    await page.goto(`/${SAMPLE_REPOSITORY}`);
    await expect(repository.notTracked(SAMPLE_REPOSITORY)).toBeVisible();
    await expect(repository.root.getByRole('listitem')).toHaveText([/Crash on start/, /Document the setup/]);

    await shell.tracked(SAMPLE_PROJECT).click();
    await expect(new ProjectScreenHarness(page).row('Document the setup')).toBeVisible();
});

test("someone else's repository, named in the address, is tracked with `T` and untracked with ⌫; typing does neither", async ({
    page,
    github,
}) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    await page.goto('/settings?q=acme%2Fweb');

    const tracking = new TrackingScreenHarness(page);
    await expect(tracking.notTracked('acme/web')).toBeVisible();

    await tracking.search.click();
    await page.keyboard.press('End');
    await page.keyboard.type('t');
    await page.keyboard.press('Backspace');
    await expect(tracking.search).toHaveValue('acme/web');
    await expect(tracking.notTracked('acme/web')).toBeVisible();

    await page.keyboard.press('ArrowDown');
    await expect(tracking.notTracked('acme/web').getByRole('button', { name: /^Track/ })).toBeFocused();
    await page.keyboard.press('t');
    await expect(tracking.tracked('acme/web')).toBeVisible();
    await expect(shell.tracked('acme/web')).toBeVisible();

    await tracking.tracked('acme/web').getByRole('link', { name: 'acme/web' }).focus();
    await page.keyboard.press('Backspace');
    await expect(tracking.tracked('acme/web')).toHaveCount(0);
    await expect(shell.tracked('acme/web')).toHaveCount(0);
    await expect(tracking.notTracked('acme/web')).toBeVisible();
});

test('the owner filter narrows to what the owner has, and nothing to offer says so only for a search', async ({
    page,
    github,
}) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    await page.goto('/settings?q=nope');

    const tracking = new TrackingScreenHarness(page);
    await expect(tracking.root.getByText('Nothing you can see matches “nope”.')).toBeVisible();

    await tracking.search.fill('');
    await tracking.ownerFilter.click();
    await page.getByRole('menuitemradio', { name: SAMPLE_REPOSITORY.split('/')[0] }).click();
    await expect(tracking.ownerFilter).toHaveText(SAMPLE_REPOSITORY.split('/')[0] ?? '');
    await expect(tracking.tracked(SAMPLE_REPOSITORY)).toBeVisible();
});
