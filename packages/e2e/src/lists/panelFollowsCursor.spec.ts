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

    await page.keyboard.press('Shift+X');
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

test('D29: ⌘Z brings the panel and the highlight back to the undone pull request, wherever the cursor walked on to', async ({
    page,
    github,
}) => {
    const work = createWork();
    const { myWork, shell } = await openMyWork(page, github, work.world);
    const item = new ItemViewHarness(page);
    await myWork.row(FIRST).click();
    await expect(item.title).toHaveText(FIRST);
    await page.keyboard.press('Shift+X');
    await expect(item.title).toHaveText(SECOND);
    await page.keyboard.press('j');
    await expect(item.title).toHaveText(THIRD);
    await expect(shell.toasts).toContainText('Closed acme/web#15');

    await page.keyboard.press('ControlOrMeta+z');

    await expect(myWork.selectedRow).toContainText(FIRST);
    await expect(item.title).toHaveText(FIRST);
    await expect.poll(() => work.world.stateOf(work.first).state).toBe('OPEN');
});

test('D29: an Undo GitHub refuses: the row leaves again, the panel stays on it with no row highlighted, and J goes on', async ({
    page,
    github,
}) => {
    const work = createWork();
    work.world.failEdit(work.first, 'ReopenPullRequest', { kind: 'refuse', message: 'Something went wrong' });
    const { myWork, shell } = await openMyWork(page, github, work.world);
    const item = new ItemViewHarness(page);
    await myWork.row(FIRST).click();
    await expect(item.title).toHaveText(FIRST);
    await page.keyboard.press('Shift+X');
    await expect(item.title).toHaveText(SECOND);

    await shell.toasts.getByRole('button', { name: 'Undo' }).click();

    await expect(shell.toasts).toContainText('GitHub refused it: Something went wrong');
    await expect(myWork.row(FIRST)).toHaveCount(0);
    await expect(item.title).toHaveText(FIRST);
    await expect(myWork.selectedRow).toHaveCount(0);
    await page.keyboard.press('j');
    await expect(item.title).toHaveText(SECOND);
    await expect(myWork.selectedRow).toContainText(SECOND);
});

test('D29: on its page, Undo shows the undone pull request when the user walked on, and changes nothing when it is shown', async ({
    page,
    github,
}) => {
    const work = createWork();
    const { myWork, shell } = await openMyWork(page, github, work.world);
    const item = new ItemViewHarness(page);
    await myWork.row(FIRST).click();
    await item.fullScreenButton.click();
    await expect(page).toHaveURL('/acme/web/pull/15');

    await page.keyboard.press('Shift+X');
    await expect(shell.toasts).toContainText('Closed acme/web#15');
    await page.keyboard.press('j');
    await expect(item.title).toHaveText(SECOND);

    await shell.toasts.getByRole('button', { name: 'Undo' }).click();
    await expect(page).toHaveURL('/acme/web/pull/15');
    await expect(item.title).toHaveText(FIRST);
    await expect.poll(() => work.world.stateOf(work.first).state).toBe('OPEN');

    await page.keyboard.press('Shift+X');
    await expect.poll(() => work.world.stateOf(work.first).state).toBe('CLOSED');
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => work.world.stateOf(work.first).state).toBe('OPEN');
    await expect(page).toHaveURL('/acme/web/pull/15');
    await expect(item.title).toHaveText(FIRST);
});

test('PM32a: a merge sent from the panel moves on at once', async ({ page, github }) => {
    const sample = createSampleMergeableWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    const panel = new MergePanelHarness(page);
    await myWork.row(FIRST_TITLE).click();
    await expect(item.title).toHaveText(FIRST_TITLE);
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
