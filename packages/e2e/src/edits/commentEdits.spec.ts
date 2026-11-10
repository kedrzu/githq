import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
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

    await item.root.getByRole('button', { name: 'Cancel' }).click();
    await expect(editor).toBeHidden();
    await expect(item.entry(TEXT)).toBeVisible();
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
