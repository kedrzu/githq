import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';

import { expect, test } from './desktopFixtures.js';
import { signInOnDesktop } from './desktopSession.js';

const READY = { kind: 'ready', version: '1.4.0' };

test('an update readied while the app runs is offered in the status bar; Restart restarts into it, and so does "Restart to update"', async ({
    page,
    github,
    native,
}) => {
    const shell = await signInOnDesktop({ page, github, native });
    await expect(shell.statusBar).toBeVisible();
    await expect(shell.updateNotice).toBeHidden();

    await expect.poll(() => native.isListening('update-state')).toBe(true);
    await native.sendUpdateState({ activity: READY });
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
    native.updateState = { ...native.updateState, activity: READY };
    const shell = await signInOnDesktop({ page, github, native });
    await expect(shell.updateNotice).toHaveText('githq 1.4.0 is ready');

    await shell.updateLaterButton.click();
    await expect(shell.updateNotice).toBeHidden();
    await expectNoUpdateCommands(new CommandMenuHarness(page));
    expect(native.restartCount).toBe(0);
});

test('a check nobody asked for says nothing until the update is ready', async ({ page, github, native }) => {
    const shell = await signInOnDesktop({ page, github, native });
    await expect.poll(() => native.isListening('update-state')).toBe(true);

    await native.sendUpdateState({ activity: { kind: 'checking' } });
    await native.sendUpdateState({ activity: { kind: 'failed', reason: 'offline' } });
    await native.sendUpdateState({ activity: { kind: 'downloading', version: '1.4.0', percent: 38 } });
    await expect(shell.statusBar.getByText(/Checking for updates|Couldn't check|Downloading/)).toHaveCount(0);

    await native.sendUpdateState({ activity: READY });
    await expect(shell.updateNotice).toBeVisible();
});

test('"Check for updates" asks the native side and the bar reports the outcome: up to date goes by itself, a failure waits', async ({
    page,
    github,
    native,
}) => {
    const shell = await signInOnDesktop({ page, github, native });
    await expect.poll(() => native.isListening('update-state')).toBe(true);

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await menu.field.pressSequentially('Check for updates');
    await page.keyboard.press('Enter');
    await expect.poll(() => native.checkCount).toBe(1);

    await native.sendUpdateState({ manual: true, activity: { kind: 'checking' } });
    await expect(shell.statusBar.getByText('Checking for updates…')).toBeVisible();

    await native.sendUpdateState({ manual: true, activity: { kind: 'upToDate' } });
    const upToDate = shell.statusBar.getByText('githq 1.3.0 is the newest version');
    await expect(upToDate).toBeVisible();
    await expect(upToDate).toBeHidden({ timeout: 10_000 });

    await native.sendUpdateState({ manual: true, activity: { kind: 'checking' } });
    await native.sendUpdateState({ manual: true, activity: { kind: 'failed', reason: 'offline' } });
    const failed = shell.statusBar.getByText("Couldn't check for updates: you're offline");
    await expect(failed).toBeVisible();

    await shell.statusBar.getByRole('button', { name: 'Try again' }).click();
    await expect.poll(() => native.checkCount).toBe(2);

    await shell.statusBar.getByRole('button', { name: 'Dismiss' }).click();
    await expect(failed).toBeHidden();
});

test('a failed install says so; Try again restarts, and nothing is offered while it installs', async ({
    page,
    github,
    native,
}) => {
    const shell = await signInOnDesktop({ page, github, native });
    await expect.poll(() => native.isListening('update-state')).toBe(true);

    await native.sendUpdateState({ activity: { kind: 'installing', version: '1.4.0' } });
    await expect(shell.statusBar.getByText('Installing githq 1.4.0…')).toBeVisible();
    await expect(shell.restartToUpdateButton).toBeHidden();

    await native.sendUpdateState({ activity: { kind: 'installFailed', version: '1.4.0' } });
    await expect(shell.statusBar.getByText("githq 1.4.0 couldn't be installed")).toBeVisible();
    expect(native.restartCount).toBe(0);

    await shell.statusBar.getByRole('button', { name: 'Try again' }).click();
    await expect.poll(() => native.restartCount).toBe(1);
});

test('a Development build goes to Stable only through the confirmation; Development to a stable version switches at once', async ({
    page,
    github,
    native,
}) => {
    native.updateState = { ...native.updateState, version: '0.3.0-dev.214', stream: 'development' };
    await signInOnDesktop({ page, github, native });

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await menu.field.pressSequentially('Switch to Stable');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/settings\?tab=updates&confirm=stable$/);
    expect(native.streamChanges).toEqual([]);

    await native.sendUpdateState({ version: '0.2.0', stream: 'stable' });
    await menu.open();
    await menu.field.pressSequentially('Switch to Development');
    await page.keyboard.press('Enter');
    await expect.poll(() => native.streamChanges).toEqual(['development']);
});

/** The command menu offers neither "Restart to update" nor "Update later". */
async function expectNoUpdateCommands(menu: CommandMenuHarness) {
    await menu.open();
    await menu.field.pressSequentially('update');
    await expect(menu.option(/^Restart to update/)).toHaveCount(0);
    await expect(menu.option(/^Update later/)).toHaveCount(0);
    await menu.page.keyboard.press('Escape');
}
