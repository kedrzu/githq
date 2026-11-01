import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';

import { expect, test } from './desktopFixtures.js';
import { signInOnDesktop } from './desktopSession.js';

test('an update readied while the app runs is offered in the status bar; Restart restarts into it, and so does "Restart to update"', async ({
    page,
    github,
    native,
}) => {
    const shell = await signInOnDesktop({ page, github, native });
    await expect(shell.statusBar).toBeVisible();
    await expect(shell.updateNotice).toBeHidden();

    await expect.poll(() => native.isListening('update-ready')).toBe(true);
    await native.sendUpdateReady('1.4.0');
    await expect(shell.updateNotice).toHaveText('githq 1.4.0 is ready');

    await shell.restartToUpdateButton.click();
    await expect.poll(() => native.restartCount).toBe(1);

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await menu.field.pressSequentially('Restart to update');
    await expect(menu.option(/^Restart to update/)).toContainText('githq 1.4.0');
    await page.keyboard.press('Enter');
    await expect.poll(() => native.restartCount).toBe(2);
});

test('an update readied before the app started is offered at once; Later hides it, and its commands go with it', async ({
    page,
    github,
    native,
}) => {
    native.readyUpdate = '1.4.0';
    const shell = await signInOnDesktop({ page, github, native });
    await expect(shell.updateNotice).toHaveText('githq 1.4.0 is ready');

    await shell.updateLaterButton.click();
    await expect(shell.updateNotice).toBeHidden();
    await expectNoUpdateCommands(new CommandMenuHarness(page));
    expect(native.restartCount).toBe(0);
});

/** The command menu offers neither "Restart to update" nor "Update later". */
async function expectNoUpdateCommands(menu: CommandMenuHarness) {
    await menu.open();
    await menu.field.pressSequentially('update');
    await expect(menu.option(/^Restart to update/)).toHaveCount(0);
    await expect(menu.option(/^Update later/)).toHaveCount(0);
    await menu.page.keyboard.press('Escape');
}
