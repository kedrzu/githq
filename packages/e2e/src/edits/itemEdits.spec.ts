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
    // The detail is read: the thread is in.
    await expect(item.root).toContainText('No description provided.');

    const release = sample.world.holdEdits();
    await item.comment('Reproduced on Safari too.');

    const comment = item.entry('Reproduced on Safari too.');
    await expect(comment).toContainText('Sending…');
    await expect(item.commentBox).toHaveValue('');
    expect(sample.world.stateOf(sample.issue).comments).toEqual([]);

    release();
    await expect(comment).not.toContainText('Sending…');
    await expect(comment).toContainText('octocat');
    await expect.poll(() => sample.world.stateOf(sample.issue).comments).toEqual(['Reproduced on Safari too.']);
    await expectConfirmed(shell);
});

test('⇧X closes an issue as completed; the composer, reopening it, closes it again as not planned', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await expect(item.statePill('Open')).toBeVisible();
    // On its page it stays in view: a panel moves on with the list once it leaves.
    await item.fullScreenButton.click();
    await expect(page).toHaveURL('/acme/web/issues/12');

    await page.keyboard.press('Shift+X');

    await expect
        .poll(() => sample.world.stateOf(sample.issue))
        .toMatchObject({ state: 'CLOSED', stateReason: 'COMPLETED' });
    await expectClosedWithUndo(shell);
    await expect(item.statePill('Closed')).toBeVisible();

    await item.composerButton('Reopen issue').click();
    await expect.poll(() => sample.world.stateOf(sample.issue)).toMatchObject({ state: 'OPEN' });
    await item.composerButton('More ways to close').click();
    await page.getByRole('menuitem', { name: 'Close as not planned' }).click();

    await expect
        .poll(() => sample.world.stateOf(sample.issue))
        .toMatchObject({ state: 'CLOSED', stateReason: 'NOT_PLANNED' });
    await expect(item.statePill('Not planned')).toBeVisible();
});

test('"Close with comment" posts the comment, then closes the issue, in that order on GitHub', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await item.fullScreenButton.click();
    await expect(item.root).toContainText('No description provided.');

    await page.keyboard.press('r');
    await item.commentBox.fill('Fixed by the token refresh.');
    await item.composerButton('Close with comment').click();

    await expect.poll(() => sample.world.stateOf(sample.issue).state).toBe('CLOSED');
    expect(sample.world.stateOf(sample.issue).comments).toEqual(['Fixed by the token refresh.']);
    expect(sample.world.edits.map(edit => edit.mutation)).toEqual(['AddComment', 'CloseIssue']);
    await expectClosedWithUndo(shell);
    await expect(item.commentBox).toHaveValue('');
});

test('"Close as not planned" from the close menu, with a comment typed, posts it, then closes the issue as not planned', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await item.fullScreenButton.click();
    await expect(item.root).toContainText('No description provided.');

    await page.keyboard.press('r');
    await item.commentBox.fill('Not something we will do.');
    await item.composerButton('More ways to close').click();
    await page.getByRole('menuitem', { name: 'Close as not planned' }).click();

    await expect
        .poll(() => sample.world.stateOf(sample.issue))
        .toMatchObject({ state: 'CLOSED', stateReason: 'NOT_PLANNED', comments: ['Not something we will do.'] });
    expect(sample.world.edits.map(edit => edit.mutation)).toEqual(['AddComment', 'CloseIssue']);
    await expect(item.statePill('Not planned')).toBeVisible();
    await expect(item.commentBox).toHaveValue('');
});

test('⇧X with a comment typed and the box left posts the comment, then closes the issue, in that order on GitHub', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await item.fullScreenButton.click();
    await expect(item.root).toContainText('No description provided.');

    await page.keyboard.press('r');
    await item.commentBox.fill('Fixed by the token refresh.');
    await item.commentBox.press('Escape');
    await page.keyboard.press('Shift+X');

    await expect
        .poll(() => sample.world.stateOf(sample.issue))
        .toMatchObject({ state: 'CLOSED', stateReason: 'COMPLETED', comments: ['Fixed by the token refresh.'] });
    expect(sample.world.edits.map(edit => edit.mutation)).toEqual(['AddComment', 'CloseIssue']);
    await expectClosedWithUndo(shell);
    await expect(item.commentBox).toHaveValue('');
});

test('the item menu\'s "Close as not planned", with a comment typed, posts it, then closes the issue as not planned', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await item.fullScreenButton.click();
    await expect(item.root).toContainText('No description provided.');

    await page.keyboard.press('r');
    await item.commentBox.fill('Not something we will do.');
    await item.menuButton.click();
    await page.getByRole('menuitem', { name: /^Close issue/ }).click();
    await page.getByRole('menuitem', { name: 'Close as not planned' }).click();

    await expect
        .poll(() => sample.world.stateOf(sample.issue))
        .toMatchObject({ state: 'CLOSED', stateReason: 'NOT_PLANNED', comments: ['Not something we will do.'] });
    expect(sample.world.edits.map(edit => edit.mutation)).toEqual(['AddComment', 'CloseIssue']);
    await expect(item.commentBox).toHaveValue('');
});

test('a comment typed in one item is kept while the user looks at another', async ({ page, github }) => {
    const sample = createSampleEditableWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await page.keyboard.press('r');
    await item.commentBox.fill('Half a thought');
    await item.commentBox.press('Escape');

    await myWork.row('Redirect once after sign-in').click();
    await expect(item.title).toHaveText('Redirect once after sign-in');
    await expect(item.commentBox).toHaveValue('');

    await myWork.row(ISSUE).click();
    await expect(item.commentBox).toHaveValue('Half a thought');
    expect(sample.world.edits).toEqual([]);
});

test('⇧X closes a pull request at once, and Undo reopens it on GitHub', async ({ page, github }) => {
    const sample = createSampleEditableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row('Redirect once after sign-in').click();
    await expect(item.statePill('Open')).toBeVisible();

    await page.keyboard.press('Shift+X');

    await expect.poll(() => sample.world.stateOf(sample.pullRequest)).toMatchObject({ state: 'CLOSED' });
    await expect(shell.toasts).toContainText('Closed acme/web#15');

    await shell.toasts.getByRole('button', { name: 'Undo' }).click();

    await expect.poll(() => sample.world.stateOf(sample.pullRequest)).toMatchObject({ state: 'OPEN' });
    // It is back in the list, and the panel and the highlight are back on it.
    await expect(myWork.selectedRow).toContainText('Redirect once after sign-in');
    await expect(item.title).toHaveText('Redirect once after sign-in');
    await expectConfirmed(shell);
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

/** GitHub took the close: nothing is on its way, nothing failed, and the only toast is the one offering Undo. */
async function expectClosedWithUndo(shell: AppShellHarness) {
    await expect(shell.statusBar).not.toContainText('Sending');
    await expect(shell.failedEdits).toHaveCount(0);
    await expect(shell.toasts).toHaveCount(1);
    await expect(shell.toasts.getByRole('button', { name: 'Undo' })).toBeVisible();
}

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
    await expectClosedWithUndo(shell);
});
