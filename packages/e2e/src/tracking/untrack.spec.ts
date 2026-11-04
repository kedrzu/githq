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

    const menu = await shell.openTrackedMenu(SAMPLE_REPOSITORY);
    await menu.getByRole('menuitem', { name: 'Stop tracking' }).click();
    await expect(shell.tracked(SAMPLE_REPOSITORY)).toHaveCount(0);

    // Assigned to the user, the issue stays in My work.
    await shell.myWorkLink('My work').click();
    await expect(new MyWorkScreenHarness(page).rows('Assigned to me')).toHaveText([/Crash on start/]);

    // Kept: the issue of My work, and the one the tracked project holds; the others are gone until GitHub is asked.
    const repository = new RepositoryScreenHarness(page);
    github.holdAnswers();
    await page.goto(`/${SAMPLE_REPOSITORY}`);
    await expect(repository.notTrackedChip).toBeVisible();
    await expect(repository.root.getByRole('listitem')).toHaveText([/Crash on start/, /Document the setup/]);
    github.releaseAnswers();
    await expect(repository.row('Add a dark theme')).toBeVisible();

    await shell.tracked(SAMPLE_PROJECT).click();
    await expect(new ProjectScreenHarness(page).row('Document the setup')).toBeVisible();

    // The picker offers it again.
    await page.goto('/settings');
    const tracking = new TrackingScreenHarness(page);
    await tracking.openButton.click();
    await expect(tracking.row(SAMPLE_REPOSITORY)).not.toBeChecked();
});

test("someone else's repository, named in the search, is picked with Space and tracked with ⌘↵; typing does neither", async ({
    page,
    github,
}) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    await page.goto('/settings?q=acme%2Fweb');

    const tracking = new TrackingScreenHarness(page);
    await expect(tracking.row('acme/web')).not.toBeChecked();

    await tracking.search.click();
    await page.keyboard.press('End');
    await page.keyboard.type('t');
    await page.keyboard.press('Backspace');
    await expect(tracking.search).toHaveValue('acme/web');
    await expect(tracking.row('acme/web')).not.toBeChecked();
    await expect(tracking.trackButton).toBeDisabled();

    await page.keyboard.press('ArrowDown');
    await expect(tracking.row('acme/web')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(tracking.dialog).toContainText('1 picked: acme/web');
    await expect(shell.tracked('acme/web')).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(tracking.dialog).toBeHidden();
    await expect(shell.tracked('acme/web')).toBeVisible();

    // Tracked, its tick is fixed.
    await tracking.openButton.click();
    await tracking.search.fill('acme/web');
    await expect(tracking.row('acme/web')).toBeChecked();
    await tracking.row('acme/web').focus();
    await page.keyboard.press('Space');
    await expect(tracking.row('acme/web')).toBeChecked();
    await expect(tracking.trackButton).toBeDisabled();
});

test('an owner picked on the left narrows to what the owner has, and nothing to offer says so only for a search', async ({
    page,
    github,
}) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    await page.goto('/settings?q=nope');

    const tracking = new TrackingScreenHarness(page);
    await expect(tracking.dialog.getByText('Nothing you can see matches “nope”.')).toBeVisible();

    await tracking.search.fill('');
    await expect(tracking.dialog.getByText(/^Nothing you can see matches/u)).toHaveCount(0);
    const owner = SAMPLE_REPOSITORY.split('/')[0] ?? '';
    await tracking.owner(owner).click();
    await expect(tracking.owner(owner)).toBeChecked();
    await expect(tracking.row(SAMPLE_REPOSITORY)).toBeChecked();
});
