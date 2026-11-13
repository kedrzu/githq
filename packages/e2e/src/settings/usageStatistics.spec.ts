import { OAUTH_SCOPES } from '@githq/github/oauth.js';
import {
    USAGE_STATISTICS_FIELD,
    USAGE_STATISTICS_OFF_KEY,
    USAGE_STATISTICS_OFF_VALUE,
} from '@githq/github/usageStatistics.js';
import type { Page } from '@playwright/test';

import { answerAuthorize } from '../auth/answerAuthorize.js';
import { expect, test } from '../fixtures.js';
import { SAMPLE_TOKEN, SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { FirstSignInHarness } from '../harnesses/FirstSignIn.harness.js';
import { LandingHarness } from '../harnesses/Landing.harness.js';
import { SettingsScreenHarness } from '../harnesses/SettingsScreen.harness.js';
import { signIn } from '../session.js';

const LOGIN = SAMPLE_VIEWER.viewer.login;

test('usage statistics turned off in Settings keep this device out of the counts, its sign-out and its next sign-in; on again, it is counted', async ({
    page,
    github,
}) => {
    const shell = await signIn(page, github);
    await page.keyboard.press(',');
    const settings = new SettingsScreenHarness(page);
    await settings.section('Privacy').click();
    await expect(page).toHaveURL('/settings?tab=privacy');

    await expect(settings.usageStatisticsSwitch).toBeChecked();
    expect(await readUsageStatisticsFlag(page)).toBeNull();

    // A click on the card's text, not on the switch itself: the whole card is the switch's.
    await page.getByText('githq counts sign-ins and visits anonymously').click({ force: true });
    await expect(settings.usageStatisticsSwitch).not.toBeChecked();
    await expect.poll(() => readUsageStatisticsFlag(page)).toBe(USAGE_STATISTICS_OFF_VALUE);

    await settings.usageStatisticsSwitch.click();
    await expect(settings.usageStatisticsSwitch).toBeChecked();
    await expect.poll(() => readUsageStatisticsFlag(page)).toBeNull();

    await settings.usageStatisticsSwitch.press('Space');
    await expect(settings.usageStatisticsSwitch).not.toBeChecked();
    await expect.poll(() => readUsageStatisticsFlag(page)).toBe(USAGE_STATISTICS_OFF_VALUE);

    await shell.signOut(LOGIN);
    await expect
        .poll(() => github.revocationBodies)
        .toEqual([{ token: SAMPLE_TOKEN, [USAGE_STATISTICS_FIELD]: false }]);

    // The flag outlives the account: the next sign-in with GitHub is not counted either.
    const authorize = answerAuthorize(github, state => ({ code: 'e2e-code', state }));
    github.tokenExchange({ accessToken: SAMPLE_TOKEN, scopes: OAUTH_SCOPES });
    await new LandingHarness(page).signInButton.click();
    await authorize;
    await expect(new FirstSignInHarness(page).continueButton).toBeVisible();
    expect(github.tokenExchangeBodies).toEqual([
        expect.objectContaining({ code: 'e2e-code', [USAGE_STATISTICS_FIELD]: false }),
    ]);
});

/** The device's opt-out flag (`UsageStatisticsFlag`), or `null` when statistics are on. */
async function readUsageStatisticsFlag(page: Page): Promise<string | null> {
    return await page.evaluate(key => localStorage.getItem(key), USAGE_STATISTICS_OFF_KEY);
}
