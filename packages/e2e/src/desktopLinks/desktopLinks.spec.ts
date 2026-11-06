import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { AccountScreenHarness } from '../harnesses/AccountScreen.harness.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { DesktopHandOffHarness } from '../harnesses/DesktopHandOff.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { LandingHarness } from '../harnesses/Landing.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork } from '../tracking/sampleTrackedWork.js';

const LOGIN = SAMPLE_VIEWER.viewer.login;
const ISSUE = 'Sign-in loops after the token expires';
const ISSUE_PATH = '/acme/web/issues/12';
/** Where this browser keeps the opt-in (`LocalPreferences`). */
const OPT_IN_KEY = 'githq.openLinksInDesktop';

async function optIn(page: Page): Promise<void> {
    await page.evaluate(key => localStorage.setItem(key, 'true'), OPT_IN_KEY);
}

/** Opts in before every page load of the test, the first one included. */
async function optInFromTheStart(page: Page): Promise<void> {
    await page.addInitScript(key => localStorage.setItem(key, 'true'), OPT_IN_KEY);
}

/** Once what the page has asked for so far has been told to the test: events come in order over one connection. */
async function settle(page: Page): Promise<void> {
    await page.evaluate(() => undefined);
}

test('with the opt-in on, a screen opened in a signed-in browser is handed to the app; "Open here instead" stays, also after a reload', async ({
    page,
    github,
}) => {
    await openMyWork(page, github, createSampleMyWork().world);
    await optIn(page);
    const handOff = new DesktopHandOffHarness(page);

    await page.goto(ISSUE_PATH);
    await expect(handOff.root).toBeVisible();
    await expect(handOff.openHereButton).toBeFocused();
    expect(handOff.handedOff).toEqual(['githq://acme/web/issues/12']);

    await handOff.openHereButton.click();
    await expect(handOff.root).toBeHidden();
    await expect(new ItemViewHarness(page).title).toHaveText(ISSUE);

    await page.reload();
    await expect(new ItemViewHarness(page).title).toHaveText(ISSUE);
    await settle(page);
    await expect(handOff.root).toBeHidden();
    expect(handOff.handedOff).toHaveLength(1);
});

test('"Don\'t open links in the app" turns the opt-in off: Settings shows the switch off, and a reload hands nothing off', async ({
    page,
    github,
}) => {
    const shell = await openMyWork(page, github, createSampleMyWork().world).then(opened => opened.shell);
    await optIn(page);
    const handOff = new DesktopHandOffHarness(page);

    await page.goto(ISSUE_PATH);
    await expect(handOff.root).toBeVisible();
    await handOff.turnOffButton.click();
    await expect(handOff.root).toBeHidden();

    await shell.openAccount(LOGIN);
    const account = new AccountScreenHarness(page);
    await expect(account.openLinksSwitch).toHaveAttribute('aria-checked', 'false');

    await page.reload();
    await expect(account.openLinksSwitch).toBeVisible();
    await settle(page);
    expect(handOff.handedOff).toHaveLength(1);
});

test('without the opt-in nothing is handed off', async ({ page, github }) => {
    await openMyWork(page, github, createSampleMyWork().world);
    const handOff = new DesktopHandOffHarness(page);

    await page.goto(ISSUE_PATH);
    await expect(new ItemViewHarness(page).title).toHaveText(ISSUE);
    await settle(page);

    expect(handOff.handedOff).toEqual([]);
    await expect(handOff.root).toBeHidden();
});

test('signed out, nothing is handed off: not on the landing page, not on /download', async ({ page }) => {
    await optInFromTheStart(page);
    const handOff = new DesktopHandOffHarness(page);

    await page.goto('/');
    await expect(new LandingHarness(page).signInButton).toBeVisible();
    await page.goto('/download');
    await expect(page.getByRole('main')).toBeVisible();
    await settle(page);

    expect(handOff.handedOff).toEqual([]);
});

test('a sign-in with a pasted token, and the choice of what to track after it, in the page that was opened signed out, hand nothing off', async ({
    page,
    github,
}) => {
    await optInFromTheStart(page);
    const handOff = new DesktopHandOffHarness(page);

    // Landing page, sign-in, the first sign-in's choice, then the shell: all in one page load.
    await openMyWork(page, github, createSampleMyWork().world);
    await settle(page);

    expect(handOff.handedOff).toEqual([]);
    await expect(handOff.root).toBeHidden();
});

test('the first download, in the page opened for the first sign-in, hands nothing off when My work opens', async ({
    page,
    github,
}) => {
    await optInFromTheStart(page);
    const handOff = new DesktopHandOffHarness(page);

    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    await expect(shell.account(LOGIN)).toBeVisible();
    await settle(page);

    expect(handOff.handedOff).toEqual([]);
    await expect(handOff.root).toBeHidden();
});

test('the Settings switch turns the opt-in on, and it lasts: the next page load hands off', async ({
    page,
    github,
}) => {
    const { shell } = await openMyWork(page, github, createSampleMyWork().world);
    await shell.openAccount(LOGIN);
    const account = new AccountScreenHarness(page);
    await expect(account.openLinksSwitch).toHaveAttribute('aria-checked', 'false');

    await account.openLinksSwitch.click();
    await expect(account.openLinksSwitch).toHaveAttribute('aria-checked', 'true');
    const handOff = new DesktopHandOffHarness(page);

    await page.reload();
    await expect(handOff.root).toBeVisible();
    expect(handOff.handedOff).toEqual(['githq://settings?tab=account']);
});

test('the command "Open in desktop app" opens the current address in the app, with the opt-in off', async ({
    page,
    github,
}) => {
    await openMyWork(page, github, createSampleMyWork().world);
    const handOff = new DesktopHandOffHarness(page);
    const menu = new CommandMenuHarness(page);

    await menu.run('Open in desktop app');

    await expect.poll(() => handOff.handedOff).toEqual(['githq://']);
    await expect(new AppShellHarness(page).account(LOGIN)).toBeVisible();
});
