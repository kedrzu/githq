import { expect, test } from '../fixtures.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { signIn } from '../session.js';

test('the sidebar collapses to the rail with its button and with [, and stays so across reloads', async ({
    page,
    github,
}) => {
    const shell = await signIn(page, github);

    await shell.collapseButton.click();
    await expect(shell.expandButton).toBeVisible();
    await expect(shell.collapseButton).toBeHidden();
    // The rail keeps the account (the avatar alone) and the allowance in short.
    await expect(shell.account(SAMPLE_VIEWER.viewer.login)).toBeVisible();
    await expect(shell.statusBar).toContainText('4.8k');

    await page.reload();
    await expect(shell.expandButton).toBeVisible();

    await page.keyboard.press('[');
    await expect(shell.collapseButton).toBeVisible();
    await expect(shell.expandButton).toBeHidden();

    await page.reload();
    await expect(shell.collapseButton).toBeVisible();

    await page.keyboard.press('[');
    await expect(shell.expandButton).toBeVisible();
});
