import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { SettingsScreenHarness } from '../harnesses/SettingsScreen.harness.js';

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
    await expect(page.getByRole('dialog', { name: 'Switch to Stable?' })).toBeVisible();
    expect(native.streamChanges).toEqual([]);

    await native.sendUpdateState({ version: '0.2.0', stream: 'stable' });
    await menu.open();
    await menu.field.pressSequentially('Switch to Development');
    await page.keyboard.press('Enter');
    await expect.poll(() => native.streamChanges).toEqual(['development']);
});

test('Settings has Updates in the desktop app: the sixth tab, on `6` and in the command menu', async ({
    page,
    github,
    native,
}) => {
    await signInOnDesktop({ page, github, native });
    await expect.poll(() => native.isListening('update-state')).toBe(true);

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await menu.field.pressSequentially('Settings: Updates');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/settings\?tab=updates$/);

    const settings = new SettingsScreenHarness(page);
    await expect(settings.section('Updates')).toHaveAttribute('aria-pressed', 'true');
    await expect(settings.section('Updates')).toHaveAttribute('aria-keyshortcuts', '6');
    await expect(page.getByText('githq 1.3.0', { exact: true })).toBeVisible();

    await page.keyboard.press('5');
    await expect(settings.section('Account')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('6');
    await expect(settings.section('Updates')).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('u');
    await expect.poll(() => native.checkCount).toBe(1);
});

test('U13: Switch to Stable opens the confirmation once; cancelling keeps the stream and takes it out of the address, confirming switches', async ({
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

    const dialog = page.getByRole('dialog', { name: 'Switch to Stable?' });
    // Behind the dialog while it is open, so out of the accessibility tree.
    const development = page.getByRole('radio', { name: 'Development', includeHidden: true });
    const stable = page.getByRole('radio', { name: 'Stable', includeHidden: true });
    await expect(dialog).toBeVisible();
    await expect(development).toBeChecked();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/settings\?tab=updates$/);
    await expect(development).toBeChecked();
    expect(native.streamChanges).toEqual([]);

    await stable.click();
    await expect(dialog).toBeVisible();
    await expect(development).toBeChecked();
    expect(native.streamChanges).toEqual([]);

    await page.keyboard.press('Enter');
    await expect.poll(() => native.streamChanges).toEqual(['stable']);
    await expect(dialog).toBeHidden();
    await expect(stable).toBeChecked();
    await expect(page).toHaveURL(/\/settings\?tab=updates$/);
    await expect(page.getByText('Development build, following Stable')).toBeVisible();

    await development.click();
    await expect.poll(() => native.streamChanges).toEqual(['stable', 'development']);
    await expect(dialog).toBeHidden();
});

test('an address asking to confirm with nothing to confirm loses it and switches nothing', async ({
    page,
    github,
    native,
}) => {
    await signInOnDesktop({ page, github, native });
    await expect.poll(() => native.isListening('update-state')).toBe(true);

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await menu.field.pressSequentially('Settings: Updates');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/settings\?tab=updates$/);

    await page.evaluate(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('confirm', 'stable');
        const state: unknown = window.history.state;
        window.history.pushState(state, '', url);
        window.dispatchEvent(new PopStateEvent('popstate', { state }));
    });
    await expect(page).toHaveURL(/\/settings\?tab=updates$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(native.streamChanges).toEqual([]);
});

test('Windows offers no choice of stream in Settings', async ({ page, github, native }) => {
    native.updateState = { ...native.updateState, canChoose: false };
    await signInOnDesktop({ page, github, native });
    await expect.poll(() => native.isListening('update-state')).toBe(true);

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await menu.field.pressSequentially('Settings: Updates');
    await page.keyboard.press('Enter');

    await expect(page.getByText('Stable version', { exact: true })).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(0);
});

/** The command menu offers neither "Restart to update" nor "Update later". */
async function expectNoUpdateCommands(menu: CommandMenuHarness) {
    await menu.open();
    await menu.field.pressSequentially('update');
    await expect(menu.option(/^Restart to update/)).toHaveCount(0);
    await expect(menu.option(/^Update later/)).toHaveCount(0);
    await menu.page.keyboard.press('Escape');
}
