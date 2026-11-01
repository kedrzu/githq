import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { SavingScreenHarness } from '../harnesses/SavingScreen.harness.js';
import { SettingsScreenHarness } from '../harnesses/SettingsScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

const LOGIN = SAMPLE_VIEWER.viewer.login;
const REPOSITORY_PATH = `/repos/${LOGIN}/githq-settings`;
const FILE_PATH = `${REPOSITORY_PATH}/contents/settings.json`;

/** The user's settings repository as the test keeps it: whether it exists, and its file. */
interface SettingsRepository {
    exists: boolean;
    file: { text: string; sha: string } | null;
}

/** A write of the settings file as the app sent it: the content in base64, over the version `sha`. */
interface SettingsWrite {
    readonly content: string;
    readonly sha: string | undefined;
}

test('turned on with no repository, githq creates it, saves what is tracked, and says it is on', async ({
    page,
    github,
}) => {
    const repository = answerSettingsRepository(github, { exists: false, file: null });
    await openSaving(page, github);

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
    expect(repository.file && JSON.parse(repository.file.text)).toMatchObject({
        version: 1,
        repositories: [{ nameWithOwner: SAMPLE_REPOSITORY, tracking: true }],
    });
});

test('turned on with settings already saved, it shows what combining changes and changes nothing until told', async ({
    page,
    github,
}) => {
    const repository = answerSettingsRepository(github, {
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
    await openSaving(page, github);

    const saving = new SavingScreenHarness(page);
    await saving.choice.click();
    await expect(saving.combining).toBeVisible();
    await expect(saving.combiningGroup('download')).toContainText('acme/web');
    await expect(saving.combiningGroup('saved')).toContainText(SAMPLE_REPOSITORY);
    await expect(saving.combiningGroup('untracked')).toHaveCount(0);
    // Nothing written, nothing tracked yet.
    expect(writes(github)).toEqual([]);
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
    answerSettingsRepository(github, {
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
    await openSaving(page, github);

    const saving = new SavingScreenHarness(page);
    await saving.choice.click();
    await expect(saving.combining).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(saving.combining).toHaveCount(0);
    await expect(saving.choice).not.toBeChecked();
    expect(writes(github)).toEqual([]);
    await expect(new AppShellHarness(page).tracked('acme/web')).toHaveCount(0);
});

test('settings found wait for an answer only while saving stays off: another tab stopping it drops them', async ({
    page,
    github,
}) => {
    answerSettingsRepository(github, {
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
    await openSaving(page, github);
    const saving = new SavingScreenHarness(page);
    await saving.choice.click();
    await expect(saving.combining).toBeVisible();

    await saveSavingFromAnotherTab(page, { state: 'stopped', reason: { kind: 'deleted' } });
    await expect(saving.stopped).toBeVisible();
    await saveSavingFromAnotherTab(page, { state: 'off' });

    await expect(saving.choice).not.toBeChecked();
    await expect(saving.combining).toHaveCount(0);
    expect(writes(github)).toEqual([]);
});

test('a repository deleted on GitHub stops syncing when the window is focused; trying again never creates it', async ({
    page,
    github,
}) => {
    const repository = answerSettingsRepository(github, { exists: false, file: null });
    await openSaving(page, github);
    const saving = new SavingScreenHarness(page);
    await saving.choice.click();
    await expect(saving.on).toBeVisible();

    repository.exists = false;
    repository.file = null;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));

    await expect(saving.stopped).toContainText(`The repository ${LOGIN}/githq-settings no longer exists on GitHub.`);
    await expect(new SettingsScreenHarness(page).section('Saving to GitHub')).toHaveAccessibleName(
        'Saving to GitHub Syncing stopped',
    );
    const created = creations(github);

    await page.keyboard.press('r');
    await expect(saving.tryAgainButton).not.toHaveAttribute('aria-busy');
    await expect(saving.stopped).toBeVisible();
    expect(creations(github)).toBe(created);
});

/** Signs in with the sample tracked, and opens Settings' Saving to GitHub. */
async function openSaving(page: Page, github: GitHubMock) {
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    await page.goto('/settings?tab=saving');
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

/** Answers the user's settings repository and its file as `repository` says, keeping what is written to it. */
function answerSettingsRepository(github: GitHubMock, repository: SettingsRepository) {
    let version = 0;
    github.rest('GET', REPOSITORY_PATH, () =>
        repository.exists
            ? { status: 200, json: { private: true, node_id: 'R_settings' } }
            : { status: 404, json: { message: 'Not Found' } },
    );
    github.rest('POST', '/user/repos', () => {
        repository.exists = true;
        return { status: 201, json: { name: 'githq-settings' } };
    });
    github.rest('GET', FILE_PATH, ({ ifNoneMatch }) => {
        const { file } = repository;
        if (!repository.exists || !file) {
            return { status: 404, json: { message: 'Not Found' } };
        }

        const etag = `"${file.sha}"`;
        return ifNoneMatch === etag
            ? { status: 304, etag }
            : {
                  status: 200,
                  etag,
                  json: { encoding: 'base64', content: Buffer.from(file.text).toString('base64'), sha: file.sha },
              };
    });
    github.rest('PUT', FILE_PATH, ({ body }) => {
        if (!repository.exists) {
            return { status: 404, json: { message: 'Not Found' } };
        }

        const sent = readWrite(body);
        if (repository.file && sent.sha !== repository.file.sha) {
            return { status: 409, json: { message: `settings.json does not match ${String(sent.sha)}` } };
        }

        repository.file = { text: Buffer.from(sent.content, 'base64').toString(), sha: `sha${++version}` };
        return { status: 200, json: { content: { sha: repository.file.sha } } };
    });
    return repository;
}

function readWrite(body: unknown): SettingsWrite {
    if (typeof body !== 'object' || body === null || !('content' in body) || typeof body.content !== 'string') {
        throw new Error('A settings write without content');
    }

    return { content: body.content, sha: 'sha' in body && typeof body.sha === 'string' ? body.sha : undefined };
}

function writes(github: GitHubMock) {
    return github.restCalls.filter(call => call.method === 'PUT' || call.method === 'POST');
}

function creations(github: GitHubMock) {
    return github.restCalls.filter(call => call.method === 'POST' && call.url.pathname === '/user/repos').length;
}
