import type { Page } from '@playwright/test';

import type { GitHubMock } from '../github/GitHubMock.js';
import { expect, test } from '../fixtures.js';
import { MyWorkScreenHarness } from '../harnesses/MyWorkScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

const ISSUE = 'Crash on start';

test('with a close and an untrack showing, the newest is at the bottom and alone shows keys; ⌘Z undoes it, and the close then takes the keys', async ({
    page,
    github,
}) => {
    const { shell, sample, closed, untracked } = await openBothToasts(page, github);

    await page.keyboard.press('ControlOrMeta+z');

    await expect(untracked).toHaveCount(0);
    await expect(shell.tracked(SAMPLE_REPOSITORY)).toBeVisible();
    // The close was not undone: it still waits for its Undo, which is now the newest's.
    expect(sample.world.stateOf(sample.assignedIssue).state).toBe('CLOSED');
    await expect(closed).toBeVisible();
    await expect(closed.locator('button[aria-keyshortcuts]')).not.toHaveCount(0);

    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => sample.world.stateOf(sample.assignedIssue).state).toBe('OPEN');
    await expect(shell.toasts).toHaveCount(0);
});

test('with a close and an untrack showing, Escape dismisses only the newest; the close stays, takes the keys, and its ⌘Z reopens', async ({
    page,
    github,
}) => {
    const { shell, sample, closed, untracked } = await openBothToasts(page, github);

    await page.keyboard.press('Escape');

    await expect(untracked).toHaveCount(0);
    // Dismissed, the untrack went through.
    await expect(shell.tracked(SAMPLE_REPOSITORY)).toHaveCount(0);
    await expect(closed).toBeVisible();
    await expect(closed.locator('button[aria-keyshortcuts]')).not.toHaveCount(0);

    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => sample.world.stateOf(sample.assignedIssue).state).toBe('OPEN');
    await expect(shell.toasts).toHaveCount(0);
});

/**
 * Closes "Crash on start" from My work (the close toast, with Undo), then stops tracking the repository from the
 * sidebar (the untrack toast, with Undo): both showing, the untrack the newest — at the bottom, alone with key hints.
 */
async function openBothToasts(page: Page, github: GitHubMock) {
    const sample = createSampleTrackedWork();
    const shell = await openTrackedWork(page, github, sample.world);
    const myWork = new MyWorkScreenHarness(page);

    await myWork.row(ISSUE).click({ button: 'right' });
    await page.getByRole('menuitem', { name: /^Close issue/ }).click();
    await page.getByRole('menuitem', { name: 'Close as completed' }).click();
    await expect.poll(() => sample.world.stateOf(sample.assignedIssue).state).toBe('CLOSED');
    const closed = shell.toasts.filter({ hasText: /^Closed / });
    await expect(closed).toBeVisible();

    const menu = await shell.openTrackedMenu(SAMPLE_REPOSITORY);
    await menu.getByRole('menuitem', { name: 'Stop tracking' }).click();
    const untracked = shell.toasts.filter({ hasText: `Stopped tracking ${SAMPLE_REPOSITORY}` });
    await expect(untracked).toBeVisible();
    await expect(shell.toasts).toHaveCount(2);

    // Where they rest, not on their way in.
    for (const toast of [closed, untracked]) {
        await toast.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
    }

    const closedBox = await closed.boundingBox();
    const untrackedBox = await untracked.boundingBox();
    expect(untrackedBox?.y ?? 0).toBeGreaterThan(closedBox?.y ?? 0);

    await expect(untracked.locator('button[aria-keyshortcuts]')).not.toHaveCount(0);
    await expect(closed.locator('button[aria-keyshortcuts]')).toHaveCount(0);
    await expect(closed.locator('kbd')).toHaveCount(0);

    return { shell, sample, closed, untracked };
}
