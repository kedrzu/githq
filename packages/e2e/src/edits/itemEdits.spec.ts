import { expect, test } from '../fixtures.js';
import type { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { PickerHarness } from '../harnesses/Picker.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';

import { createSampleEditableWork } from './sampleEditableWork.js';

const ISSUE = 'Sign-in loops after the token expires';

test("S sets the first project's Status, confirmed in the item, its row and the project on GitHub", async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await expect(item.projectField('Status')).toHaveAccessibleName('Status: Todo');

    await page.keyboard.press('s');
    await new PickerHarness(page, 'Status').choose('In Progress');

    await expect.poll(() => sample.world.stateOf(sample.issue).projects).toEqual({ Roadmap: 'In Progress' });
    await expectConfirmed(shell);
    await expect(item.projectField('Status')).toHaveAccessibleName('Status: In Progress');
    await expect(myWork.row(ISSUE)).toContainText('In Progress');
});

test('"Add to project" offers the projects the user can write to and adds the item to the one picked', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await expect(item.project('Roadmap')).toBeVisible();

    await item.addToProjectButton.click();
    const projects = new PickerHarness(page, 'Add to project');
    // The project it is in already is not offered.
    await expect(projects.root.getByRole('option')).toHaveCount(1);
    await projects.choose('Platform');

    await expect.poll(() => sample.world.stateOf(sample.issue).projects).toEqual({ Roadmap: 'Todo', Platform: null });
    await expectConfirmed(shell);
    await expect(item.project('Platform')).toBeVisible();
});

test('a comment shows at once as on its way, then as posted', async ({ page, github }) => {
    const sample = createSampleEditableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await expect(item.root).toContainText('No comments yet.');

    const release = sample.world.holdEdits();
    await item.comment('Reproduced on Safari too.');

    const comment = item.entry('Reproduced on Safari too.');
    await expect(comment).toContainText('sending…');
    await expect(item.commentBox).toHaveValue('');
    expect(sample.world.stateOf(sample.issue).comments).toEqual([]);

    release();
    await expect(comment).not.toContainText('sending…');
    await expect(comment).toContainText('octocat');
    await expect.poll(() => sample.world.stateOf(sample.issue).comments).toEqual(['Reproduced on Safari too.']);
    await expectConfirmed(shell);
});

test('⇧X closes an issue as not planned', async ({ page, github }) => {
    const sample = createSampleEditableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await expect(item.statePill('Open')).toBeVisible();

    await page.keyboard.press('Shift+X');
    await page.getByRole('menuitem', { name: 'Close as not planned' }).click();

    await expect
        .poll(() => sample.world.stateOf(sample.issue))
        .toMatchObject({ state: 'CLOSED', stateReason: 'NOT_PLANNED' });
    await expectConfirmed(shell);
    await expect(item.statePill('Not planned')).toBeVisible();
});

test('⇧R asks for reviews of a pull request', async ({ page, github }) => {
    const sample = createSampleEditableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row('Redirect once after sign-in').click();
    await expect(item.root).toContainText('No reviews yet.');

    await page.keyboard.press('Shift+R');
    const reviewers = new PickerHarness(page, 'Request a review');
    // Not the author.
    await expect(reviewers.option('octocat')).toHaveCount(0);
    // With the mouse this time: Escape closes the picker, not the item under it.
    await reviewers.option('monalisa').click();
    await reviewers.close();
    await expect(item.title).toBeVisible();

    await expect.poll(() => sample.world.stateOf(sample.pullRequest).reviewRequests).toEqual(['monalisa']);
    await expectConfirmed(shell);
    await expect(item.entry('monalisa')).toContainText('Requested');
});

test('the item menu (⌘.) marks a draft pull request ready for review', async ({ page, github }) => {
    const sample = createSampleEditableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row('Cache response headers').click();
    await expect(item.statePill('Draft')).toBeVisible();

    await page.keyboard.press('ControlOrMeta+.');
    await page.getByRole('menuitem', { name: 'Ready for review' }).click();

    await expect.poll(() => sample.world.stateOf(sample.draft).isDraft).toBe(false);
    await expectConfirmed(shell);
    await expect(item.statePill('Open')).toBeVisible();
    await expect(myWork.row('Cache response headers').getByRole('img', { name: 'Open pull request' })).toBeVisible();
});

test('the item menu works in the modal: its reference opens it over the dialog and its entries can be picked', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row('Cache response headers').click();
    await item.arrangement('Modal').click();
    await expect(item.modal).toBeVisible();

    await item.menuButton.click();
    await page.getByRole('menuitem', { name: 'Ready for review' }).click();

    await expect.poll(() => sample.world.stateOf(sample.draft).isDraft).toBe(false);
    await expect(item.statePill('Open')).toBeVisible();
    // The status bar is under the modal, out of reach until it closes.
    await page.keyboard.press('Escape');
    await expect(item.modal).toBeHidden();
    await expectConfirmed(shell);
});

/** GitHub answered the user's edits and took them: nothing is on its way, nothing failed. */
async function expectConfirmed(shell: AppShellHarness) {
    await expect(shell.statusBar).not.toContainText('Sending');
    await expect(shell.failedEdits).toHaveCount(0);
    await expect(shell.toasts).toHaveCount(0);
}

test('right-clicking a row opens its context menu: the issue is closed as not planned from the list', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);

    await myWork.row(ISSUE).click({ button: 'right' });
    const menu = page.getByRole('menu');
    await expect(menu).toContainText('acme/web#');
    await page.getByRole('menuitem', { name: /^Close issue/ }).click();
    await page.getByRole('menuitem', { name: 'Close as not planned' }).click();

    await expect
        .poll(() => sample.world.stateOf(sample.issue))
        .toMatchObject({ state: 'CLOSED', stateReason: 'NOT_PLANNED' });
    await expectConfirmed(shell);
});
