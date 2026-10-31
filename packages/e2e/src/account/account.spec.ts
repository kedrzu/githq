import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { AccountScreenHarness } from '../harnesses/AccountScreen.harness.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { SignInScreenHarness } from '../harnesses/SignInScreen.harness.js';
import { E2E_CLIENT_ID } from '../localApp.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';
import { readStoredToken, signIn } from '../session.js';
import { answerTrackingCandidates } from '../tracking/answerTracking.js';

const LOGIN = SAMPLE_VIEWER.viewer.login;

/** What is kept of the browser's own, whoever signs in: the sidebar folded, how an item opens. */
const PER_DEVICE_KEYS = ['githq.sidebarCollapsed', 'githq.itemArrangement'];

test('the account page shows an organisation hiding its private data, and remembers that approval was requested', async ({
    page,
    github,
}) => {
    const shell = await signIn(page, github);
    answerTrackingCandidates(github, {
        login: LOGIN,
        organizations: [{ login: 'acme', repositories: [] }],
        hidingOrganizations: ['secretive'],
    });
    github.web(`/settings/connections/applications/${E2E_CLIENT_ID}`, () => ({
        status: 200,
        headers: { 'content-type': 'text/html' },
        body: "githq's OAuth App on GitHub",
    }));
    // The organisations are read once a session: a reload reads them again.
    await page.reload();

    await shell.openAccount(LOGIN);
    const account = new AccountScreenHarness(page);
    await expect(page).toHaveURL('/settings');
    await expect(account.heading).toBeVisible();
    await expect(account.root).toContainText(/member of\s2 organisations/);
    await expect(account.organization('acme')).toContainText('No restrictions');
    await expect(account.organization('secretive')).toContainText('Private repositories and projects hidden');
    await expect(account.organization('secretive')).not.toContainText('You requested approval');

    // GitHub's page of the OAuth App, where the approval is requested, through the Worker.
    const popup = page.waitForEvent('popup');
    await account.requestApproval('secretive').click();
    await expect((await popup).locator('body')).toHaveText("githq's OAuth App on GitHub");
    await expect(account.organization('secretive')).toContainText(/You requested approval on\s\w{3} \d+\./);
    await page.screenshot({ path: '../../.context/m6-account.png' });

    await page.reload();
    await expect(account.organization('secretive')).toContainText('You requested approval on');
});

test('⌘K finds the account page', async ({ page, github }) => {
    await signIn(page, github);
    answerTrackingCandidates(github, { login: LOGIN });

    await page.keyboard.press('ControlOrMeta+K');
    await page.keyboard.type('account');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL('/settings');
    await expect(new AccountScreenHarness(page).root).toContainText('member of no organisations');
});

test("signing out on the account page deletes this browser's copy and signs out every tab", async ({
    page,
    context,
    github,
}) => {
    const sample = createSampleMyWork();
    const { shell } = await openMyWork(page, github, sample.world);
    // Kept for the account: how its lists are shown.
    await page.keyboard.press('Shift+V');
    // Kept for the device: the sidebar folded.
    await shell.collapseButton.click();
    await expect.poll(() => readLocalDatabases(page)).toContain(`githq-${LOGIN}`);
    expect(await readStoredKeys(page)).toEqual(
        expect.arrayContaining([`githq.listViews.${LOGIN}`, 'githq.sidebarCollapsed', 'githq.token']),
    );

    const otherTab = await context.newPage();
    await otherTab.goto('/');
    await expect(new AppShellHarness(otherTab).account(LOGIN)).toBeVisible();

    answerTrackingCandidates(github, { login: LOGIN });
    await shell.openAccount(LOGIN);
    const account = new AccountScreenHarness(page);
    await expect(account.copy).toContainText(/^no\srepositories, no\sprojects · \d+\sitems · /);
    await account.signOutButton.click();

    for (const tab of [page, otherTab]) {
        await expect(tab).toHaveURL(/^[^?]*\/login\?next=/);
        await expect(new SignInScreenHarness(tab).signInButton).toBeVisible();
        expect(await readStoredToken(tab)).toBeNull();
        await expect.poll(() => readLocalDatabases(tab)).not.toContain(`githq-${LOGIN}`);
        expect((await readStoredKeys(tab)).filter(key => !PER_DEVICE_KEYS.includes(key))).toEqual([]);
    }
});

/** The names of the IndexedDB databases of the app's origin. */
async function readLocalDatabases(page: Page): Promise<string[]> {
    return await page.evaluate(async () => (await indexedDB.databases()).map(database => database.name ?? ''));
}

/** The keys of the app's `localStorage`. */
async function readStoredKeys(page: Page): Promise<string[]> {
    return await page.evaluate(() => Object.keys(localStorage));
}
