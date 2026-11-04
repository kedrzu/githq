import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { MergePanelHarness } from '../harnesses/MergePanel.harness.js';
import { PickerHarness } from '../harnesses/Picker.harness.js';
import { createSampleMergeableWork, FIRST_TITLE, PROPOSED_TITLE, SECOND_TITLE } from '../merge/sampleMergeableWork.js';
import { openMyWork } from '../myWork/openMyWork.js';

const FIRST = 'Redirect once after sign-in';
const SECOND = 'Cache response headers';
const THIRD = 'Read the rate limit from the headers';

/** The viewer's three pull requests in acme/web, #15, #16 and #17, listed in that order. */
function createWork() {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
    const pullRequest = (number: number, title: string, minutesAgo: number) =>
        world.pullRequest({ repository: 'acme/web', number, title, foundBy: ['authored'], minutesAgo });

    return {
        world,
        first: pullRequest(15, FIRST, 10),
        second: pullRequest(16, SECOND, 20),
        third: pullRequest(17, THIRD, 30),
    };
}

test('a pull request closed from the panel: the highlight, the panel, the chip and a single-key edit are on the next row', async ({
    page,
    github,
}) => {
    const work = createWork();
    const { myWork } = await openMyWork(page, github, work.world);
    const item = new ItemViewHarness(page);
    await myWork.row(FIRST).click();
    await expect(item.title).toHaveText(FIRST);

    await closeOpened(page);
    await expect.poll(() => work.world.stateOf(work.first).state).toBe('CLOSED');

    await expect(myWork.selectedRow).toContainText(SECOND);
    await expect(item.title).toHaveText(SECOND);

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await expect(menu.chip('web#16')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.keyboard.press('l');
    const labels = new PickerHarness(page, 'Labels');
    await labels.choose('bug');
    await labels.close();
    await expect.poll(() => work.world.stateOf(work.second).labels).toEqual(['bug']);
    expect(work.world.stateOf(work.first).labels).toEqual([]);
});

test('the last pull request closed from the panel: the highlight and the panel go to the row before it', async ({
    page,
    github,
}) => {
    const work = createWork();
    const { myWork } = await openMyWork(page, github, work.world);
    const item = new ItemViewHarness(page);
    await myWork.row(THIRD).click();
    await expect(item.title).toHaveText(THIRD);

    await closeOpened(page);
    await expect.poll(() => work.world.stateOf(work.third).state).toBe('CLOSED');

    await expect(myWork.selectedRow).toContainText(SECOND);
    await expect(item.title).toHaveText(SECOND);
});

test('a pull request leaving through a sync: the panel and the chip stay on it with no row highlighted, and the next J opens its former neighbour', async ({
    page,
    github,
}) => {
    // Time runs as usual, and the 30 seconds to the next poll can be skipped.
    await page.clock.install();
    const work = createWork();
    const { myWork } = await openMyWork(page, github, work.world);
    const item = new ItemViewHarness(page);
    await myWork.row(SECOND).click();
    await expect(item.title).toHaveText(SECOND);

    work.world.leave(work.second, 'authored');
    await page.clock.fastForward('00:30');

    await expect(myWork.row(SECOND)).toHaveCount(0);
    await expect(myWork.selectedRow).toHaveCount(0);
    await expect(item.title).toHaveText(SECOND);

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await expect(menu.chip('web#16')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.keyboard.press('j');
    await expect(myWork.selectedRow).toContainText(THIRD);
    await expect(item.title).toHaveText(THIRD);
});

test('PM32a: a merge sent from a modal moves on at once', async ({ page, github }) => {
    const sample = createSampleMergeableWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    const panel = new MergePanelHarness(page);
    await myWork.row(FIRST_TITLE).click();
    await item.arrangement('Modal').click();
    await expect(item.modal).toBeVisible();
    await item.mergeButton.click();
    await expect(panel.line('Commit')).toContainText(PROPOSED_TITLE);

    const release = sample.world.holdMerges();
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.root).toBeHidden();
    await expect(item.title).toHaveText(SECOND_TITLE);
    release();
});

test('a merge sent from its page stays there', async ({ page, github }) => {
    const sample = createSampleMergeableWork();
    await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    const panel = new MergePanelHarness(page);
    await page.goto('/acme/web/pull/15');
    await item.mergeButton.click();
    await expect(panel.line('Commit')).toContainText(PROPOSED_TITLE);

    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.root).toBeHidden();
    await expect.poll(() => sample.world.stateOf(sample.first).merged).toBe(true);
    await expect(page).toHaveURL('/acme/web/pull/15');
    await expect(item.title).toHaveText(FIRST_TITLE);
});

test('SP6: a stack merged up to its last pull request from the panel moves past the stack', async ({
    page,
    github,
}) => {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
    world.repository('acme/web', { defaultMergeMethod: 'SQUASH' });
    world.stack({
        repository: 'acme/web',
        number: 1,
        pullRequests: [
            { number: 101, title: 'Stack first', foundBy: ['authored'], reviewDecision: 'APPROVED', minutesAgo: 30 },
            { number: 102, title: 'Stack last', foundBy: ['authored'], reviewDecision: 'APPROVED', minutesAgo: 20 },
        ],
    });
    world.pullRequest({
        repository: 'acme/web',
        number: 16,
        title: SECOND,
        foundBy: ['authored'],
        reviewDecision: 'APPROVED',
        minutesAgo: 60,
    });
    const { myWork } = await openMyWork(page, github, world);
    const item = new ItemViewHarness(page);
    const panel = new MergePanelHarness(page);
    await myWork.row('Stack first').click();
    await item.stackMapRows.filter({ hasText: '#102' }).click();
    await expect(item.title).toHaveText('Stack last');
    await item.mergeButton.click();
    await expect(panel.primary).toHaveAccessibleName(/2/);

    const release = world.holdMerges();
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.root).toBeHidden();
    await expect(myWork.selectedRow).toContainText(SECOND);
    await expect(item.title).toHaveText(SECOND);
    release();
});

test('in a modal, a pull request leaving through a sync stays open, and J opens its former neighbour', async ({
    page,
    github,
}) => {
    await page.clock.install();
    const work = createWork();
    const { myWork } = await openMyWork(page, github, work.world);
    const item = new ItemViewHarness(page);
    await myWork.row(SECOND).click();
    await item.arrangement('Modal').click();
    await expect(item.modal).toBeVisible();

    work.world.leave(work.second, 'authored');
    await page.clock.fastForward('00:30');
    await expect(item.position).toHaveCount(0);
    await expect(item.title).toHaveText(SECOND);

    await page.keyboard.press('j');
    await expect(item.title).toHaveText(THIRD);
});

/** `⇧X` and the entry of the opened pull request's submenu. */
async function closeOpened(page: Page) {
    await page.keyboard.press('Shift+X');
    await page
        .getByRole('menu', { name: 'Close pull request' })
        .getByRole('menuitem', { name: 'Close pull request' })
        .click();
}
