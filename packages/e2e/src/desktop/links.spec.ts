import type { Page } from '@playwright/test';

import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { AccountScreenHarness } from '../harnesses/AccountScreen.harness.js';
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
