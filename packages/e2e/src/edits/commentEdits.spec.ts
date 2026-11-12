import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { MyWorkScreenHarness } from '../harnesses/MyWorkScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';

import { createSampleEditableWork } from './sampleEditableWork.js';

const ISSUE = 'Sign-in loops after the token expires';
const TEXT = 'Reproduced on Safari.';

/** The sample, the issue opened with one comment of the viewer's on it. */
async function openWithComment(page: Page, github: GitHubMock) {
    const sample = createSampleEditableWork();
    sample.world.comment(sample.issue, { author: sample.world.viewer, body: TEXT, minutesAgo: 3 });
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await expect(item.entry(TEXT)).toBeVisible();
    return { sample, shell, item };
}

test('a comment edited in place shows at once, then as GitHub has it, "· edited"', async ({ page, github }) => {
    const { sample, item } = await openWithComment(page, github);

    const release = sample.world.holdEdits();
    await item.commentAction(TEXT, 'Edit');
    const editor = item.root.getByRole('textbox', { name: 'Edit comment' });
    await expect(editor).toHaveValue(TEXT);
    await editor.fill('Reproduced on Safari and Firefox.');
    await editor.press('ControlOrMeta+Enter');

    const comment = item.entry('Reproduced on Safari and Firefox.');
    await expect(comment).toContainText('Sending…');
    expect(sample.world.stateOf(sample.issue).comments).toEqual([TEXT]);

    release();
    await expect(comment).toContainText('· edited');
    await expect(comment).not.toContainText('Sending…');
    await expect.poll(() => sample.world.stateOf(sample.issue).comments).toEqual(['Reproduced on Safari and Firefox.']);
});

test('narrowed while an edit is open, the item stays in the panel; it moves to its page once the edit closes', async ({
    page,
    github,
}) => {
    const { item } = await openWithComment(page, github);
    await item.commentAction(TEXT, 'Edit');
    const editor = item.root.getByRole('textbox', { name: 'Edit comment' });
    await editor.fill('Reproduced on Safari and Firefox.');

    // The sidebar's 236 px, the list's 400 and the panel's 400 need 1,036.
    await page.setViewportSize({ width: 1000, height: 800 });
    // Two frames: the shell has measured the window, and the item has had its chance to move.
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await expect(editor).toHaveValue('Reproduced on Safari and Firefox.');
    await expect(page).toHaveURL(/pane=issue/u);

    await editor.press('ControlOrMeta+Enter');
    await expect(page).toHaveURL('/acme/web/issues/12');
    await expect(item.entry('Reproduced on Safari and Firefox.')).toBeVisible();
});

test('an edit GitHub refuses is undone with its toast and opens the editor again with the text and why', async ({
    page,
    github,
}) => {
    const { sample, shell, item } = await openWithComment(page, github);
    sample.world.failEdit(sample.issue, 'UpdateIssueComment', { kind: 'refuse', message: 'Body is too long' });

    await item.commentAction(TEXT, 'Edit');
    const editor = item.root.getByRole('textbox', { name: 'Edit comment' });
    await editor.fill('A much longer text.');
    await editor.press('ControlOrMeta+Enter');

    await expect(shell.toasts.filter({ hasText: "Your edit of a comment on acme/web#12 wasn't saved" })).toBeVisible();
    await expect(item.root.getByRole('alert')).toHaveText('Not sent: GitHub refused it: Body is too long.');
    await expect(editor).toHaveValue('A much longer text.');
    expect(sample.world.stateOf(sample.issue).comments).toEqual([TEXT]);

    // Not taken, it counts as changed: Cancel asks first.
    await item.root.getByRole('button', { name: 'Cancel' }).click();
    await item.root.getByRole('button', { name: 'Discard' }).click();
    await expect(editor).toBeHidden();
    await expect(item.entry(TEXT)).toBeVisible();
});

test('J with a changed edit open stays on the item and asks; Discard discards and goes on to the next item', async ({
    page,
    github,
}) => {
    const { sample, item } = await openWithComment(page, github);
    const myWork = new MyWorkScreenHarness(page);
    await expect(myWork.selectedRow).toContainText(ISSUE);

    await item.commentAction(TEXT, 'Edit');
    const editor = item.root.getByRole('textbox', { name: 'Edit comment' });
    await editor.fill('Reproduced on Safari and Firefox.');
    await editor.blur();
    await page.keyboard.press('j');

    await expect(item.root.getByRole('status')).toHaveText('Discard your changes to this comment?');
    await expect(editor).toBeFocused();
    await expect(item.title).toHaveText(ISSUE);
    await expect(myWork.selectedRow).toContainText(ISSUE);

    await item.root.getByRole('button', { name: 'Discard' }).click();
    await expect(item.title).toHaveText('Flaky login test');
    await expect(myWork.selectedRow).toContainText('Flaky login test');
    expect(sample.world.stateOf(sample.issue).comments).toEqual([TEXT]);
});

test('Keep editing forgets where J was going: Discard asked by the editor itself stays on the item', async ({
    page,
    github,
}) => {
    const { item } = await openWithComment(page, github);

    await item.commentAction(TEXT, 'Edit');
    const editor = item.root.getByRole('textbox', { name: 'Edit comment' });
    await editor.fill('Reproduced on Safari and Firefox.');
    await editor.blur();
    await page.keyboard.press('j');
    const question = item.root.getByRole('status');
    await expect(question).toHaveText('Discard your changes to this comment?');

    await editor.press('Escape');
    await expect(question).toBeHidden();
    await item.root.getByRole('button', { name: 'Cancel' }).click();
    await item.root.getByRole('button', { name: 'Discard' }).click();

    await expect(editor).toBeHidden();
    await expect(item.entry(TEXT)).toBeVisible();
    await expect(item.title).toHaveText(ISSUE);
});

test('Back with a changed edit open asks too; Discard goes back', async ({ page, github }) => {
    const { item } = await openWithComment(page, github);

    await item.commentAction(TEXT, 'Edit');
    const editor = item.root.getByRole('textbox', { name: 'Edit comment' });
    await editor.fill('Reproduced on Safari and Firefox.');
    await page.goBack();

    await expect(item.root.getByRole('status')).toHaveText('Discard your changes to this comment?');
    await expect(item.title).toHaveText(ISSUE);

    await item.root.getByRole('button', { name: 'Discard' }).click();
    await expect(item.title).toBeHidden();
    await expect(page).not.toHaveURL(/issue=/u);
});

test('Delete… asks once, then the comment is gone, here and on GitHub', async ({ page, github }) => {
    const { sample, item } = await openWithComment(page, github);

    await item.commentAction(TEXT, 'Delete…');
    const dialog = page.getByRole('dialog', { name: 'Delete this comment?' });
    await dialog.getByRole('button', { name: 'Delete comment' }).click();

    await expect(dialog).toBeHidden();
    await expect(item.entry(TEXT)).toBeHidden();
    await expect.poll(() => sample.world.stateOf(sample.issue).comments).toEqual([]);
});

test('a delete GitHub refuses brings the comment back, with its toast', async ({ page, github }) => {
    const { sample, shell, item } = await openWithComment(page, github);
    sample.world.failEdit(sample.issue, 'DeleteIssueComment', {
        kind: 'refuse',
        message: 'Resource not accessible by integration',
    });

    await item.commentAction(TEXT, 'Delete…');
    await page
        .getByRole('dialog', { name: 'Delete this comment?' })
        .getByRole('button', { name: 'Delete comment' })
        .click();

    await expect(shell.toasts.filter({ hasText: "A comment on acme/web#12 wasn't deleted" })).toBeVisible();
    await expect(item.entry(TEXT)).toBeVisible();
    expect(sample.world.stateOf(sample.issue).comments).toEqual([TEXT]);
});

test('Quote reply puts the comment, quoted, into the comment box after what is typed, the cursor in it', async ({
    page,
    github,
}) => {
    const { item } = await openWithComment(page, github);
    await item.commentBox.fill('Thanks.');

    await item.commentAction(TEXT, 'Quote reply');

    await expect(item.commentBox).toHaveValue(`Thanks.\n\n> ${TEXT}\n\n`);
    await expect(item.commentBox).toBeFocused();
});
