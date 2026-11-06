import { SAMPLE_VIEWER } from '../github/sampleViewer.js';

import { expect, test } from './desktopFixtures.js';
import { signInOnDesktop } from './desktopSession.js';

test('on a Mac ⌘[ goes back and ⌘] goes forward', async ({ page, github, native }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'userAgentData', { value: { platform: 'macOS' } });
    });
    const shell = await signInOnDesktop({ page, github, native });
    const start = page.url();

    await shell.openAccount(SAMPLE_VIEWER.viewer.login);
    await expect(page).toHaveURL('/settings?tab=account');

    await page.keyboard.press('Meta+BracketLeft');
    await expect(page).toHaveURL(start);

    await page.keyboard.press('Meta+BracketRight');
    await expect(page).toHaveURL('/settings?tab=account');
});
