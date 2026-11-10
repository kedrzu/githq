import type { GitHubMock } from '../github/GitHubMock.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { SettingsScreenHarness } from '../harnesses/SettingsScreen.harness.js';

import { expect, test } from './desktopFixtures.js';
import { signInOnDesktop } from './desktopSession.js';

const READY = { kind: 'ready', version: '1.4.0' };

test('an update readied while the app runs is offered in a toast, not the status bar; Restart restarts into it, and so do ⌥R and "Restart to update"', async ({
    page,
    github,
    native,
}) => {
    const shell = await signInOnDesktop({ page, github, native });
    await expect(shell.statusBar).toBeVisible();
    await expect(shell.updateReadyToast).toHaveCount(0);

    await expect.poll(() => native.isListening('update-state')).toBe(true);
    await native.sendUpdateState({ activity: READY });
    await expect(shell.updateReadyToast).toContainText("Restart to switch to it. You're on 1.3.0 until then.");
    await expect(shell.updateNotice).toBeHidden();
    await expect(shell.restartToUpdateButton).toBeHidden();

    await shell.updateReadyToast.getByRole('button', { name: 'Restart' }).click();
    await expect.poll(() => native.restartCount).toBe(1);

    await page.keyboard.press('Alt+KeyR');
    await expect.poll(() => native.restartCount).toBe(2);

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await menu.field.pressSequentially('Restart to update');
    await expect(menu.option(/^Restart to update/)).toContainText('githq 1.4.0');
    await page.keyboard.press('Enter');
    await expect.poll(() => native.restartCount).toBe(3);
});

test('an update readied before the app started is offered at once; Dismiss leaves "ready · Restart" in the status bar and Restart in the menu', async ({
    page,
    github,
    native,
}) => {
    native.updateState = { ...native.updateState, activity: READY };
    const shell = await signInOnDesktop({ page, github, native });
    await expect(shell.updateReadyToast).toBeVisible();

    await shell.updateReadyToast.getByRole('button', { name: 'Dismiss' }).first().click();
    await expect(shell.updateReadyToast).toHaveCount(0);
    await expect(shell.updateNotice).toHaveText('githq 1.4.0 ready');
    await expect(shell.statusBar.getByRole('button', { name: 'Later' })).toHaveCount(0);
    expect(native.restartCount).toBe(0);

    await shell.restartToUpdateButton.click();
    await expect.poll(() => native.restartCount).toBe(1);

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await menu.field.pressSequentially('update');
    await expect(menu.option(/^Update later/)).toHaveCount(0);
    await expect(menu.option(/^Restart to update/)).toContainText('githq 1.4.0');
    await menu.field.fill('Restart to update');
    await page.keyboard.press('Enter');
    await expect.poll(() => native.restartCount).toBe(2);
});

test('a check nobody asked for says nothing until the update is ready', async ({ page, github, native }) => {
    const shell = await signInOnDesktop({ page, github, native });
    await expect.poll(() => native.isListening('update-state')).toBe(true);

    await native.sendUpdateState({ activity: { kind: 'checking' } });
    await native.sendUpdateState({ activity: { kind: 'failed', reason: 'offline' } });
    await native.sendUpdateState({ activity: { kind: 'downloading', version: '1.4.0', percent: 38 } });
    await expect(shell.statusBar.getByText(/Checking for updates|Couldn't check|Downloading/)).toHaveCount(0);

    await native.sendUpdateState({ activity: READY });
    await expect(shell.updateReadyToast).toBeVisible();
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

test('a failed install says so in a toast with Try again, which restarts; dismissed, the status bar keeps Try again; nothing is offered while it installs', async ({
    page,
    github,
    native,
}) => {
    const shell = await signInOnDesktop({ page, github, native });
    await expect.poll(() => native.isListening('update-state')).toBe(true);

    await native.sendUpdateState({ activity: { kind: 'installing', version: '1.4.0' } });
    await expect(shell.statusBar.getByText('Installing githq 1.4.0…')).toBeVisible();
    await expect(shell.restartToUpdateButton).toBeHidden();
    await expect(shell.toasts).toHaveCount(0);

    await native.sendUpdateState({ activity: { kind: 'installFailed', version: '1.4.0' } });
    const failed = shell.toasts.filter({ hasText: "githq 1.4.0 couldn't be installed" });
    await expect(failed).toContainText("You're still on 1.3.0. Nothing is lost.");
    await expect(shell.statusBar.getByText("githq 1.4.0 couldn't be installed")).toBeHidden();
    expect(native.restartCount).toBe(0);

    await failed.getByRole('button', { name: 'Try again' }).click();
    await expect.poll(() => native.restartCount).toBe(1);

    await failed.getByRole('button', { name: 'Dismiss' }).first().click();
    await expect(failed).toHaveCount(0);
    await expect(shell.statusBar.getByText("githq 1.4.0 couldn't be installed")).toBeVisible();
    await shell.statusBar.getByRole('button', { name: 'Try again' }).click();
    await expect.poll(() => native.restartCount).toBe(2);
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

test('Settings has Updates in the desktop app: the seventh tab, on `7` and in the command menu', async ({
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
    await expect(settings.section('Updates')).toHaveAttribute('aria-keyshortcuts', '7');
    await expect(page.getByText('githq 1.3.0', { exact: true })).toBeVisible();

    await page.keyboard.press('6');
    await expect(settings.section('Account')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('7');
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

test('after an update the toast says so once and What changed leads to the Changelog; the first ever run says nothing', async ({
    page,
    github,
    native,
}) => {
    answerChangelog(github);
    const shell = await signInOnDesktop({ page, github, native });
    await expect.poll(() => native.isListening('update-state')).toBe(true);
    await expect(shell.toasts).toHaveCount(0);

    native.updateState = { ...native.updateState, version: '1.4.0' };
    await page.reload();
    const toast = shell.toasts.filter({ hasText: 'Updated to githq 1.4.0' });
    await expect(toast).toContainText('You were on 1.3.0.');
    // Where it rests, not a few pixels short of it while it slides in.
    await toast.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
    const corner = await toast.boundingBox();
    const window = page.viewportSize();
    expect((corner?.x ?? 0) + (corner?.width ?? 0)).toBe((window?.width ?? 0) - 16);

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await menu.field.pressSequentially('What changed');
    await expect(menu.option(/^What changed/)).toBeVisible();
    await page.keyboard.press('Escape');

    await toast.getByRole('button', { name: 'What changed' }).click();
    await expect(page).toHaveURL(/\/settings\?tab=changelog$/);
    await expect(toast).toBeHidden();

    const settings = new SettingsScreenHarness(page);
    await expect(settings.section('Changelog')).toHaveAttribute('aria-pressed', 'true');
    await expect(settings.section('Changelog')).toHaveAttribute('aria-keyshortcuts', '8');
    const latest = page.getByRole('button', { name: /^githq 1\.4\.0/ });
    await expect(latest).toHaveAttribute('aria-expanded', 'true');
    await expect(latest).toContainText(/New\s*Running/);
    await expect(page.getByRole('button', { name: /^githq 1\.3\.0/ })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('heading', { name: 'Features' })).toBeVisible();

    expect(github.graphqlCalls.filter(call => call.name === 'RepositoryReleases')).toHaveLength(1);

    await page.reload();
    await expect(shell.account(SAMPLE_VIEWER.viewer.login)).toBeVisible();
    await expect(latest).toContainText(/New\s*Running/);
    await expect(shell.toasts).toHaveCount(0);
});

test('⌥W is What changed while the toast shows', async ({ page, github, native }) => {
    answerChangelog(github);
    const shell = await signInOnDesktop({ page, github, native });
    await expect.poll(() => native.isListening('update-state')).toBe(true);

    native.updateState = { ...native.updateState, version: '1.4.0' };
    await page.reload();
    await expect(shell.toasts.filter({ hasText: 'Updated to githq 1.4.0' })).toBeVisible();

    await page.keyboard.press('Alt+KeyW');
    await expect(page).toHaveURL(/\/settings\?tab=changelog$/);
    await expect(shell.toasts).toHaveCount(0);
});

test('going back to an older version says which runs and offers no list', async ({ page, github, native }) => {
    native.updateState = { ...native.updateState, version: '0.3.0-dev.214', stream: 'development' };
    const shell = await signInOnDesktop({ page, github, native });
    await expect.poll(() => native.isListening('update-state')).toBe(true);

    native.updateState = { ...native.updateState, version: '0.2.0', stream: 'stable' };
    await page.reload();

    const toast = shell.toasts.filter({ hasText: "You're on githq 0.2.0" });
    await expect(toast).toBeVisible();
    await expect(toast.getByRole('button', { name: 'What changed' })).toHaveCount(0);
});

test('a Development build lists its commits since the last Stable, and O opens them on GitHub', async ({
    page,
    github,
    native,
}) => {
    native.updateState = { ...native.updateState, version: '1.5.0-dev.214', commit: 'abc1234', stream: 'development' };
    answerChangelog(github);
    await signInOnDesktop({ page, github, native });

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await menu.field.pressSequentially('Settings: Changelog');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('button', { name: /^Development/ })).toContainText(/since 1\.4\.0\s*Running/);
    await expect(page.getByText("1 change you'd notice, out of 2 commits.")).toBeVisible();
    // Its pull requests open in githq.
    await expect(page.getByRole('link', { name: '#7' })).toHaveAttribute('href', '/kedrzu/githq/pull/7');
    expect(github.graphqlCalls.find(call => call.name === 'CommitSubjects')?.variables.from).toBe('abc1234');

    await page.keyboard.press('o');
    await expect.poll(() => native.opened).toEqual(['https://github.com/kedrzu/githq/commits/abc1234']);
});

test('a refused read answers with the failure and the releases on GitHub, and opening again reads again', async ({
    page,
    github,
    native,
}) => {
    github.graphql('RepositoryReleases', { status: 403, message: 'API rate limit exceeded' });
    await signInOnDesktop({ page, github, native });

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await menu.field.pressSequentially('Settings: Changelog');
    await page.keyboard.press('Enter');
    await expect(page.getByText("Couldn't load the changelog")).toBeVisible();

    answerChangelog(github);
    const settings = new SettingsScreenHarness(page);
    await settings.section('Updates').click();
    await settings.section('Changelog').click();
    await expect(page.getByRole('button', { name: /^githq 1\.4\.0/ })).toBeVisible();
});

/** GitHub's answers for the Changelog: two Stable versions, and commits back to the last of them. */
function answerChangelog(github: GitHubMock) {
    github.graphql('RepositoryReleases', {
        repository: {
            releases: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [
                    {
                        tagName: 'v1.3.0',
                        isDraft: false,
                        isPrerelease: false,
                        publishedAt: '2026-10-21T10:00:00Z',
                        descriptionHTML: '<h2>Fixes</h2><ul><li>Keep the focus</li></ul>',
                        tagCommit: { oid: 'older' },
                    },
                    {
                        tagName: 'v1.4.0',
                        isDraft: false,
                        isPrerelease: false,
                        publishedAt: '2026-11-03T10:00:00Z',
                        descriptionHTML: '<h2>Features</h2><ul><li>Merge pull requests</li></ul>',
                        tagCommit: { oid: 'tagged' },
                    },
                    {
                        tagName: 'development',
                        isDraft: false,
                        isPrerelease: true,
                        publishedAt: '2026-11-04T10:00:00Z',
                        descriptionHTML: null,
                        tagCommit: { oid: 'abc1234' },
                    },
                ],
            },
        },
    });
    github.graphql('CommitSubjects', {
        repository: {
            object: {
                history: {
                    pageInfo: { hasNextPage: false, endCursor: null },
                    nodes: [
                        { oid: 'abc1234', message: 'feat: add a thing (#7)' },
                        { oid: 'def5678', message: 'chore: tidy (#6)' },
                        { oid: 'tagged', message: 'chore: the last Stable' },
                    ],
                },
            },
        },
    });
}
