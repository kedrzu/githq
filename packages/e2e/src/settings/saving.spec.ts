import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { SavingScreenHarness } from '../harnesses/SavingScreen.harness.js';
import { SettingsScreenHarness } from '../harnesses/SettingsScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

import { answerSettingsRepository, countSettingsCreations, getSettingsWrites } from './answerSettingsRepository.js';
import type { SettingsRepository } from './answerSettingsRepository.js';

const LOGIN = SAMPLE_VIEWER.viewer.login;

test('turned on with no repository, githq creates it, saves what is tracked, and says it is on', async ({
    page,
    github,
}) => {
    const repository = await openSaving(page, github, { exists: false, file: null });

    const saving = new SavingScreenHarness(page);
    await expect(saving.choice).not.toBeChecked();
    await saving.choice.focus();
    await page.keyboard.press('Space');

    await expect(saving.on).toBeVisible();
    await expect(saving.root.getByRole('link', { name: `${LOGIN}/githq-settings` })).toHaveAttribute(
        'href',
        `https://github.com/${LOGIN}/githq-settings`,
    );
    expect(github.restCalls.some(call => call.method === 'POST' && call.url.pathname === '/user/repos')).toBe(true);
    await expect
        .poll((): unknown => repository.file && JSON.parse(repository.file.text))
        .toMatchObject({
            version: 1,
            repositories: [{ nameWithOwner: SAMPLE_REPOSITORY, tracking: true }],
        });
});

test('turned on with settings already saved, it shows what combining changes and changes nothing until told', async ({
    page,
    github,
}) => {
    const repository = await openSaving(page, github, {
        exists: true,
        file: {
            text: JSON.stringify({
                version: 1,
                repositories: [{ nameWithOwner: 'acme/web', id: 'R_web', tracking: true }],
                projects: [],
            }),
            sha: 'saved',
        },
    });

    const saving = new SavingScreenHarness(page);
    await saving.choice.click();
    await expect(saving.combining).toBeVisible();
    await expect(saving.combiningGroup('download')).toContainText('acme/web');
    await expect(saving.combiningGroup('saved')).toContainText(SAMPLE_REPOSITORY);
    await expect(saving.combiningGroup('untracked')).toHaveCount(0);
    // Nothing written, nothing tracked yet.
    expect(getSettingsWrites(github)).toEqual([]);
    const shell = new AppShellHarness(page);
    await expect(shell.tracked('acme/web')).toHaveCount(0);

    await saving.combineButton.click();

    await expect(saving.on).toBeVisible();
    await expect(shell.tracked('acme/web')).toBeVisible();
    await expect.poll(() => repository.file?.sha).not.toBe('saved');
    expect(JSON.parse(repository.file?.text ?? 'null')).toMatchObject({
        repositories: [{ nameWithOwner: 'acme/web' }, { nameWithOwner: SAMPLE_REPOSITORY }],
    });
});

test('cancelled, combining writes nothing and tracks nothing', async ({ page, github }) => {
    await openSaving(page, github, {
        exists: true,
        file: {
            text: JSON.stringify({
                version: 1,
                repositories: [{ nameWithOwner: 'acme/web', id: 'R_web', tracking: true }],
                projects: [],
            }),
            sha: 'saved',
        },
    });

    const saving = new SavingScreenHarness(page);
    await saving.choice.click();
    await expect(saving.combining).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(saving.combining).toHaveCount(0);
    await expect(saving.choice).not.toBeChecked();
    expect(getSettingsWrites(github)).toEqual([]);
    await expect(new AppShellHarness(page).tracked('acme/web')).toHaveCount(0);
});

test('settings found wait for an answer only while saving stays off: another tab stopping it drops them', async ({
    page,
    github,
}) => {
    await openSaving(page, github, {
        exists: true,
        file: {
            text: JSON.stringify({
                version: 1,
                repositories: [{ nameWithOwner: 'acme/web', id: 'R_web', tracking: true }],
                projects: [],
            }),
            sha: 'saved',
        },
    });
    const saving = new SavingScreenHarness(page);
    await saving.choice.click();
    await expect(saving.combining).toBeVisible();

    await saveSavingFromAnotherTab(page, { state: 'stopped', reason: { kind: 'deleted' } });
    await expect(saving.stopped).toBeVisible();
    await saveSavingFromAnotherTab(page, { state: 'off' });

    await expect(saving.choice).not.toBeChecked();
    await expect(saving.combining).toHaveCount(0);
    expect(getSettingsWrites(github)).toEqual([]);
});

test('a repository deleted on GitHub stops syncing when the window is focused; trying again never creates it', async ({
    page,
    github,
}) => {
    const repository = await openSaving(page, github, { exists: false, file: null });
    const saving = new SavingScreenHarness(page);
    await saving.choice.click();
    await expect(saving.on).toBeVisible();

    repository.exists = false;
    repository.file = null;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));

    await expect(saving.stopped).toContainText(`The repository ${LOGIN}/githq-settings no longer exists on GitHub.`);
    await expect(new SettingsScreenHarness(page).section('Sync settings')).toHaveAccessibleName(
        'Sync settings Syncing stopped',
    );
    const created = countSettingsCreations(github);

    await page.keyboard.press('r');
    await expect(saving.tryAgainButton).not.toHaveAttribute('aria-busy');
    await expect(saving.stopped).toBeVisible();
    expect(countSettingsCreations(github)).toBe(created);
});

test('a stop is told once in a toast, ⌥S opens why, and the dot on the avatar stays until syncing is turned off', async ({
    page,
    github,
}) => {
    const repository = await openSaving(page, github, { exists: false, file: null });
    const saving = new SavingScreenHarness(page);
    await saving.choice.click();
    await expect(saving.on).toBeVisible();
    await page.goto('/');

    const shell = new AppShellHarness(page);
    repository.exists = false;
    repository.file = null;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));

    await expect(shell.syncStoppedToast).toContainText(
        `The repository ${LOGIN}/githq-settings no longer exists on GitHub. githq keeps working from what's on this device.`,
    );
    await expect(shell.accountSyncStopped(LOGIN)).toBeVisible();

    await page.keyboard.press('Alt+KeyS');
    await expect(page).toHaveURL(/\/settings\?tab=sync$/u);
    await expect(saving.stopped).toBeVisible();
    await expect(shell.syncStoppedToast).toHaveCount(0);

    await page.goto('/');
    await expect(shell.accountSyncStopped(LOGIN)).toBeVisible();
    await expect(shell.syncStoppedToast).toHaveCount(0);

    await shell.accountSyncStopped(LOGIN).click();
    await page.getByRole('menuitem', { name: /^Settings/u }).click();
    await expect(page).toHaveURL(/\/settings\?tab=sync$/u);
    await saving.turnOffButton.click();

    await expect(saving.choice).not.toBeChecked();
    await expect(shell.account(LOGIN)).toHaveAccessibleName(`Account: ${LOGIN}`);
});

test('the repository layout chosen with saving on is written to the file, and is still chosen after a reload', async ({
    page,
    github,
}) => {
    const repository = await openSaving(page, github, { exists: false, file: null });
    const saving = new SavingScreenHarness(page);
    await saving.choice.click();
    await expect(saving.on).toBeVisible();
    await expect.poll(() => repository.file).not.toBeNull();

    await page.goto('/settings?tab=display');
    const settings = new SettingsScreenHarness(page);
    await expect(settings.repositoryLayoutKept(`Saved with your settings in ${LOGIN}/githq-settings`)).toBeVisible();
    await expect(settings.repositoryLayout('Tabs')).toBeChecked();
    await settings.repositoryLayout('Tabs').focus();
    await page.keyboard.press('ArrowRight');
    await expect(settings.repositoryLayout('Column')).toBeChecked();

    await expect
        .poll((): unknown => repository.file && JSON.parse(repository.file.text))
        .toMatchObject({ repositoryLayout: 'column' });

    await page.reload();
    await expect(settings.repositoryLayout('Column')).toBeChecked();
    await expect(settings.repositoryLayout('Tabs')).not.toBeChecked();
});

test('the repository layout chosen with saving off stays on this device, through a reload', async ({
    page,
    github,
}) => {
    await openSaving(page, github, { exists: false, file: null });

    await page.goto('/settings?tab=display');
    const settings = new SettingsScreenHarness(page);
    await expect(settings.repositoryLayoutKept('Saving is off, so this stays on this device.')).toBeVisible();
    await settings.repositoryLayout('Column').click();
    await expect(settings.repositoryLayout('Column')).toBeChecked();

    await page.reload();
    await expect(settings.repositoryLayout('Column')).toBeChecked();
    expect(getSettingsWrites(github)).toEqual([]);
});

/**
 * Signs in with the sample tracked, then answers the settings repository as `repository` says — none on the first
 * sign-in, so it offers no saved settings — and opens Settings' Sync settings.
 */
async function openSaving(page: Page, github: GitHubMock, repository: SettingsRepository) {
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    const answered = answerSettingsRepository(github, repository);
    await page.goto('/settings?tab=sync');
    return answered;
}

/** Another tab writes the saving state into the settings' slot, and this window is focused, which reads it. */
async function saveSavingFromAnotherTab(page: Page, saving: unknown) {
    await page.evaluate(
        ({ key, state }) => {
            localStorage.setItem(
                key,
                JSON.stringify({ ...JSON.parse(localStorage.getItem(key) ?? '{}'), saving: state }),
            );
            window.dispatchEvent(new Event('focus'));
        },
        { key: `githq.settings.${LOGIN}`, state: saving },
    );
}
