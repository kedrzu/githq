import { expect, test } from '../fixtures.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { PickerHarness } from '../harnesses/Picker.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';

import { createSampleEditableWork } from './sampleEditableWork.js';

const ISSUE = 'Sign-in loops after the token expires';

test('a label added shows at once, and stays once GitHub confirms it — in the item, its row and on GitHub', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await expect(item.property('Labels')).toHaveAccessibleName('Labels: None');

    const release = sample.world.holdEdits();
    await page.keyboard.press('l');
    const labels = new PickerHarness(page, 'Labels');
    await labels.choose('bug');
    await labels.close();

    // Shown before GitHub answered.
    await expect(item.property('Labels')).toHaveAccessibleName('Labels: bug');
    await expect(myWork.row(ISSUE).getByText('bug', { exact: true })).toBeVisible();
    await expect(shell.statusBar).toContainText('Sending 1 change');
    expect(sample.world.stateOf(sample.issue).labels).toEqual([]);

    release();
    await expect(shell.statusBar).not.toContainText('Sending');
    await expect(shell.failedEdits).toHaveCount(0);
    await expect(item.property('Labels')).toHaveAccessibleName('Labels: bug');
    await expect(myWork.row(ISSUE).getByText('bug', { exact: true })).toBeVisible();
    expect(sample.world.stateOf(sample.issue).labels).toEqual(['bug']);
});

test('an edit GitHub refuses with an error is undone, with its toast and "1 change failed" — which brings the toast back once it timed out', async ({
    page,
    github,
}) => {
    await page.clock.install();
    const sample = createSampleEditableWork();
    sample.world.failEdit(sample.issue, 'AddLabels', {
        kind: 'refuse',
        message: 'Resource not accessible by integration',
    });
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await expect(item.property('Labels')).toHaveAccessibleName('Labels: None');

    await page.keyboard.press('l');
    const labels = new PickerHarness(page, 'Labels');
    await labels.choose('bug');
    await labels.close();

    const toast = shell.toasts.filter({ hasText: "Label “bug” wasn't added to acme/web#12" });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('GitHub refused it: Resource not accessible by integration. It was undone.');
    await expect(item.property('Labels')).toHaveAccessibleName('Labels: None');
    await expect(shell.failedEdits.first()).toHaveText('1 change failed · label “bug” refused by GitHub');
    expect(sample.world.stateOf(sample.issue).labels).toEqual([]);
    expect(sample.world.edits).toEqual([{ mutation: 'AddLabels', itemId: sample.issue }]);

    // Timed out, the toast goes; the failure stays in the status bar until dismissed, and brings it back.
    await page.clock.fastForward('00:13');
    await expect(toast).toBeHidden();
    await expect(shell.failedEdits.first()).toBeVisible();
    await shell.failedEdits.first().click();
    await expect(toast).toBeVisible();

    await toast.getByRole('button', { name: 'Dismiss' }).first().click();
    await expect(toast).toBeHidden();
    await expect(shell.failedEdits).toHaveCount(0);
});

test('a value GitHub silently drops (D14) is undone, with its toast and "1 change failed"', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    sample.world.failEdit(sample.issue, 'AddAssignees', { kind: 'drop' });
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await expect(item.property('Assignees')).toHaveAccessibleName('Assignees: octocat');

    await page.keyboard.press('a');
    const assignees = new PickerHarness(page, 'Assignees');
    await assignees.choose('monalisa');
    await assignees.close();

    const toast = shell.toasts.filter({ hasText: "monalisa wasn't assigned to acme/web#12" });
    await expect(toast).toContainText(
        "GitHub didn't keep it — in acme/web your role doesn't allow this change. It was undone.",
    );
    await expect(item.property('Assignees')).toHaveAccessibleName('Assignees: octocat');
    await expect(shell.failedEdits.first()).toHaveText('1 change failed · monalisa no permission');
    // GitHub was asked, and answered without the change.
    expect(sample.world.edits).toEqual([{ mutation: 'AddAssignees', itemId: sample.issue }]);
    expect(sample.world.stateOf(sample.issue).assignees).toEqual(['octocat']);
});

test('a label added to three selected items, one of which GitHub refuses, says "1 of 3 failed", undoes only that one and ⇧F selects it alone', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    sample.world.failEdit(sample.secondIssue, 'AddLabels', { kind: 'refuse', message: 'Something went wrong' });
    const { myWork, shell } = await openMyWork(page, github, sample.world);

    // The rows: #15, #30, then the three issues — selected together with x.
    for (const key of ['j', 'j', 'j', 'x', 'j', 'x', 'j', 'x']) {
        await page.keyboard.press(key);
    }

    await expect(myWork.root.getByRole('toolbar', { name: 'Selected items' })).toContainText('3 selected');
    await page.keyboard.press('l');
    const labels = new PickerHarness(page, 'Labels');
    await labels.choose('bug');
    await labels.close();

    const toast = shell.toasts.filter({ hasText: '“bug” added to 2 of 3 items' });
    await expect(toast).toContainText('web#21 failed: GitHub refused it: Something went wrong. It was undone.');
    await expect(shell.failedEdits.first()).toHaveText('1 of 3 changes failed · web#21');
    await expect(myWork.row(ISSUE).getByText('bug', { exact: true })).toBeVisible();
    await expect(myWork.row('Document the keyboard shortcuts').getByText('bug', { exact: true })).toBeVisible();
    await expect(myWork.row('Flaky login test').getByText('bug', { exact: true })).toBeHidden();
    await expect(myWork.row('Flaky login test')).toContainText('“bug” label undone');

    expect(sample.world.stateOf(sample.issue).labels).toEqual(['bug']);
    expect(sample.world.stateOf(sample.thirdIssue).labels).toEqual(['bug']);
    expect(sample.world.stateOf(sample.secondIssue).labels).toEqual([]);

    // The help sheet lists the list's own keys and ⇧F beside the rest; closing it leaves the selection.
    await page.keyboard.press('?');
    const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    const view = help.getByRole('region', { name: 'This view' });
    const listKeys: readonly (readonly [string, readonly string[]])[] = [
        ['Next item', ['J', 'ArrowDown']],
        ['Previous item', ['K', 'ArrowUp']],
        ['Select for editing together', ['X']],
        ['Select the next one too', ['Shift+J', 'Shift+ArrowDown']],
        ['Select the previous one too', ['Shift+K', 'Shift+ArrowUp']],
        ['Clear the selection', ['Escape']],
    ];
    for (const [title, keys] of listKeys) {
        // Each key as the help reads it out, beside its chips.
        await expect(view.getByRole('term').filter({ hasText: title }).locator('+ dd')).toContainText(
            new RegExp(keys.map(key => key.replace('+', '\\+')).join('.*'), 'u'),
        );
    }

    await expect(
        help
            .getByRole('region', { name: 'Anywhere' })
            .getByRole('term')
            .filter({ hasText: 'Select the items that failed' }),
    ).toBeVisible();
    await help.getByRole('button', { name: 'Close' }).click();
    await expect(help).toBeHidden();

    // ⇧F selects the failed item alone, to try again or act on it.
    await expect(toast.getByRole('button', { name: 'Select the failed item' })).toBeVisible();
    await page.keyboard.press('Shift+F');
    const selection = myWork.root.getByRole('toolbar', { name: 'Selected items' });
    await expect(selection).toContainText('1 selected');
    await expect(myWork.row('Flaky login test').getByRole('img', { name: 'Selected', exact: true })).toBeVisible();
    await expect(myWork.row(ISSUE).getByRole('img', { name: 'Selected', exact: true })).toBeHidden();
});

test('a comment GitHub refuses goes back into the empty comment box; over something typed since, its toast restores it', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    sample.world.failEdit(sample.issue, 'AddComment', { kind: 'refuse', message: 'Commenting is disabled' });
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();

    await item.comment('Reproduced on Safari 18');

    const toasts = shell.toasts.filter({ hasText: "Your comment on acme/web#12 wasn't posted" });
    await expect(toasts.first()).toBeVisible();
    await expect(item.commentBox).toHaveValue('Reproduced on Safari 18');
    await expect(toasts.first().getByRole('button', { name: 'Restore comment' })).toBeHidden();

    // Typed into the box while the next one is on its way: that one does not overwrite it.
    const release = sample.world.holdEdits();
    await item.commentBox.fill('Also on Chrome');
    await item.commentBox.press('ControlOrMeta+Enter');
    await expect(item.commentBox).toHaveValue('');
    await item.commentBox.fill('Typed meanwhile');
    release();

    await expect(toasts).toHaveCount(2);
    await expect(item.commentBox).toHaveValue('Typed meanwhile');
    const restore = toasts.last().getByRole('button', { name: 'Restore comment' });
    await restore.click();
    await expect(item.commentBox).toHaveValue('Typed meanwhile\n\nAlso on Chrome');
    await expect(restore).toBeHidden();
});

test("with a failed edit's toast showing, Escape closes the keyboard help over it first, then dismisses the toast", async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    sample.world.failEdit(sample.issue, 'AddLabels', {
        kind: 'refuse',
        message: 'Resource not accessible by integration',
    });
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await expect(item.property('Labels')).toHaveAccessibleName('Labels: None');
    await page.keyboard.press('l');
    const labels = new PickerHarness(page, 'Labels');
    await labels.choose('bug');
    await labels.close();
    const toast = shell.toasts.filter({ hasText: "Label “bug” wasn't added to acme/web#12" });
    await expect(toast).toBeVisible();

    await page.keyboard.press('?');
    const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(help).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(help).toBeHidden();
    await expect(toast).toBeVisible();
    await expect(item.root).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(toast).toBeHidden();
    await expect(item.root).toBeVisible();
});
