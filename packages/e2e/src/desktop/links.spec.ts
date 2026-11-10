import type { Page } from '@playwright/test';

import { SAMPLE_TOKEN, SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { DesktopSignInScreenHarness } from '../harnesses/DesktopSignInScreen.harness.js';
import { FirstSignInHarness } from '../harnesses/FirstSignIn.harness.js';
import { AccountScreenHarness } from '../harnesses/AccountScreen.harness.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { E2E_CLIENT_ID } from '../localApp.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';
import { answerTrackingCandidates } from '../tracking/answerTracking.js';

import { expect, test } from './desktopFixtures.js';
import { signInOnDesktop } from './desktopSession.js';

const LOGIN = SAMPLE_VIEWER.viewer.login;
const ISSUE = 'Sign-in loops after the token expires';
const ISSUE_PATH = '/acme/web/issues/12';
/** The link in the issue's description. */
const BODY_LINK = 'https://example.com/docs/tokens';
/** Where the desktop app opens the docs: githq.dev's, as it has none of its own. */
const DOCS_URL = 'https://githq.dev/docs/';

test('an app path opens directly', async ({ page, github, native }) => {
    await signInOnDesktop({ page, github, native, world: createSampleMyWork().world });

    await page.goto(ISSUE_PATH);
    await expect(new ItemViewHarness(page).title).toHaveText(ISSUE);
    await expect(page).toHaveURL(ISSUE_PATH);
});

test('an item\'s "Open on GitHub", a link in its description and an address githq hands to GitHub open in the system browser, and the window stays on the item', async ({
    page,
    github,
    native,
}) => {
    const sample = createSampleMyWork();
    sample.world.issue({
        repository: 'acme/web',
        number: 30,
        title: 'Explain how tokens expire',
        foundBy: ['assigned'],
        minutesAgo: 40,
        bodyHtml: `<p>See <a href="${BODY_LINK}">the token docs</a>.</p>`,
    });
    await signInOnDesktop({ page, github, native, world: sample.world });
    const item = new ItemViewHarness(page);
    const itemPath = '/acme/web/issues/30';
    await page.goto(itemPath);
    await expect(item.title).toHaveText('Explain how tokens expire');

    await item.root.getByRole('link', { name: 'Open on GitHub' }).click();
    await expect.poll(() => native.opened).toEqual(['https://github.com/acme/web/issues/30']);
    await expect(page).toHaveURL(itemPath);

    // `O` opens it the same way.
    await page.keyboard.press('o');
    await expect.poll(() => native.opened).toHaveLength(2);
    expect(native.opened[1]).toBe('https://github.com/acme/web/issues/30');

    await item.root.getByRole('link', { name: 'the token docs' }).click();
    await expect.poll(() => native.opened).toHaveLength(3);
    expect(native.opened[2]).toBe(BODY_LINK);
    await expect(page).toHaveURL(itemPath);

    // An address githq does not show (`GitHubHandOffPage`), reached from within the app.
    await navigateInApp(page, '/orgs/acme?tab=people');
    await expect.poll(() => native.opened).toHaveLength(4);
    expect(native.opened[3]).toBe('https://github.com/orgs/acme?tab=people');
    await expect(page).toHaveURL(itemPath);
    await expect(item.title).toHaveText('Explain how tokens expire');

    expect(page.context().pages()).toHaveLength(1);
});

test("an organisation's \"Request approval\" opens GitHub's page of githq's OAuth App in the system browser, and the window stays on the Account section", async ({
    page,
    github,
    native,
}) => {
    const shell = await signInOnDesktop({ page, github, native });
    answerTrackingCandidates(github, { login: LOGIN, hidingOrganizations: ['secretive'] });
    // The organisations are read once a session: a reload reads them again.
    await page.reload();
    await shell.openAccount(LOGIN);
    const account = new AccountScreenHarness(page);
    await expect(page).toHaveURL('/settings?tab=account');

    await account.requestApproval('secretive').click();
    await expect
        .poll(() => native.opened)
        .toEqual([`https://github.com/settings/connections/applications/${E2E_CLIENT_ID}`]);
    await expect(page).toHaveURL('/settings?tab=account');
    await expect(account.organization('secretive')).toContainText('You requested approval on');
    expect(page.context().pages()).toHaveLength(1);
});

test('"Documentation" in the command menu and in the account menu opens githq.dev\'s docs in the system browser, and the window stays where it is', async ({
    page,
    github,
    native,
}) => {
    const shell = await signInOnDesktop({ page, github, native });
    const appUrl = page.url();

    await new CommandMenuHarness(page).run('Documentation');
    await expect.poll(() => native.opened).toEqual([DOCS_URL]);

    await shell.account(LOGIN).click();
    await page.getByRole('menu').getByRole('menuitem', { name: 'Documentation' }).click();
    await expect.poll(() => native.opened).toEqual([DOCS_URL, DOCS_URL]);

    expect(page.url()).toBe(appUrl);
    expect(page.context().pages()).toHaveLength(1);
});

test('a githq link opened while the app runs shows its screen without reloading the page', async ({
    page,
    github,
    native,
}) => {
    await signInOnDesktop({ page, github, native, world: createSampleMyWork().world });
    await page.evaluate(() => {
        window.name = 'before-the-link';
    });
    const origin = await page.evaluate(() => performance.timeOrigin);
    // Listening: the page has asked for the link events.
    await expect.poll(() => native.isListening('link-opened')).toBe(true);

    await native.openLink(ISSUE_PATH);

    await expect(new ItemViewHarness(page).title).toHaveText(ISSUE);
    await expect(page).toHaveURL(ISSUE_PATH);
    // The same document: it was not loaded again.
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin);
    expect(await page.evaluate(() => window.name)).toBe('before-the-link');
    expect(native.pendingLink).toBeNull();
});

test('an app started with a githq link opens on its screen', async ({ page, github, native }) => {
    await signInOnDesktop({ page, github, native, world: createSampleMyWork().world });

    native.pendingLink = ISSUE_PATH;
    await page.reload();

    await expect(new ItemViewHarness(page).title).toHaveText(ISSUE);
    await expect(page).toHaveURL(ISSUE_PATH);
    expect(native.pendingLink).toBeNull();
});

test('signed out, a githq link shows the sign-in and the screen of the link follows the sign-in', async ({
    page,
    github,
    native,
}) => {
    createSampleMyWork().world.install(github);
    github.graphql('Viewer', SAMPLE_VIEWER);
    answerTrackingCandidates(github, { login: LOGIN });
    native.pendingLink = ISSUE_PATH;

    await page.goto('/');
    const signIn = new DesktopSignInScreenHarness(page);
    await expect(signIn.signInButton).toBeVisible();
    await expect(page).toHaveURL(`/?next=${ISSUE_PATH}`);

    await signIn.signInButton.click();
    await expect(signIn.deviceCode).toHaveText(native.deviceCode.userCode);
    native.approveDeviceSignIn(SAMPLE_TOKEN);
    // The first sign-in's choice comes first, then the screen of the link.
    await new FirstSignInHarness(page).continueButton.click();

    await expect(new ItemViewHarness(page).title).toHaveText(ISSUE);
    await expect(page).toHaveURL(ISSUE_PATH);
});

test('a click on a githq.dev link, or a github.com link to a screen githq shows, opens it in the app; any other github.com link opens in the system browser', async ({
    page,
    github,
    native,
}) => {
    const sample = createSampleMyWork();
    sample.world.issue({
        repository: 'acme/web',
        number: 30,
        title: 'Explain how tokens expire',
        foundBy: ['assigned'],
        minutesAgo: 40,
        bodyHtml: `<p>See <a href="https://githq.dev${ISSUE_PATH}?x=1">the sign-in issue</a>, <a href="https://github.com/acme/web/issues/12">#12</a> and <a href="https://github.com/acme/web/commit/a1b2c3d">the fix</a>.</p>`,
    });
    await signInOnDesktop({ page, github, native, world: sample.world });
    await page.goto('/acme/web/issues/30');
    const item = new ItemViewHarness(page);
    await expect(item.title).toHaveText('Explain how tokens expire');

    await item.root.getByRole('link', { name: 'the fix' }).click();
    await expect.poll(() => native.opened).toEqual(['https://github.com/acme/web/commit/a1b2c3d']);
    await expect(page).toHaveURL('/acme/web/issues/30');

    // A modifier changes nothing: the app has one window.
    await item.root.getByRole('link', { name: '#12' }).click({ modifiers: ['ControlOrMeta'] });
    await expect(item.title).toHaveText(ISSUE);
    await expect(page).toHaveURL(ISSUE_PATH);

    await page.goBack();
    await expect(item.title).toHaveText('Explain how tokens expire');
    await item.root.getByRole('link', { name: 'the sign-in issue' }).click();
    await expect(item.title).toHaveText(ISSUE);
    await expect(page).toHaveURL(`${ISSUE_PATH}?x=1`);
    expect(native.opened).toEqual(['https://github.com/acme/web/commit/a1b2c3d']);
    expect(page.context().pages()).toHaveLength(1);
});

/**
 * Goes to `path` within the app, as a link of the app (`RouterLink`) does: through the app's router, which Vue keeps
 * on the element the app is mounted on.
 */
async function navigateInApp(page: Page, path: string) {
    await page.evaluate(async to => {
        const router = document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$router;
        if (!router) {
            throw new Error("The app's router is not on #__nuxt");
        }

        await router.push(to);
    }, path);
}

/** What the tests use of the Vue app on the element it is mounted on (`app.mount` sets `__vue_app__`). */
interface MountedVueApp {
    readonly config: {
        readonly globalProperties: {
            readonly $router?: { push(to: string): Promise<unknown> };
        };
    };
}

declare global {
    interface Element {
        __vue_app__?: MountedVueApp;
    }
}
