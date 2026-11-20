import AxeBuilder from '@axe-core/playwright';
import { ACCESSIBILITY_TAGS } from '@githq/app/testing/accessibilityTags.js';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { expectButtonSizes } from './expectButtonSizes.js';

/** What `expectAccessible` checks beyond the whole page with axe. */
export interface ExpectAccessibleOptions {
    /**
     * A CSS selector, for a layer that holds the focus and hides the page from assistive technology (a menu, a popover):
     * only it is checked then. The page behind it has its own state in the walk.
     */
    readonly within?: string;
    /**
     * `false` leaves the buttons' sizes unchecked (`expectButtonSizes`, by default checked): the landing page and the docs
     * follow their own design, not the app's button guideline.
     */
    readonly buttonSizes?: boolean;
}

/**
 * Checks the page as it stands now with axe, under the same tags as the stories (`.storybook/preview.ts`), and, on the
 * app's screens, its buttons against their sizes. Soft, so one walk through a screen reports all of its states; each
 * violation shows its rule, its elements and why.
 */
export async function expectAccessible(
    page: Page,
    state: string,
    options: ExpectAccessibleOptions = {},
): Promise<void> {
    const { within, buttonSizes = true } = options;
    // An overlay still fading in has a colour mixed with what is behind it, which is not the one it rests on.
    await page.evaluate(() =>
        Promise.all(
            document
                .getAnimations()
                .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
                .map(animation => animation.finished.catch(() => undefined)),
        ),
    );
    const axe = new AxeBuilder({ page }).withTags(ACCESSIBILITY_TAGS);
    if (within !== undefined) {
        axe.include(within);
    }
    // Two things axe reports that aren't what its rules are after. A panel's resize handle is a focusable line with no
    // content for `region` to want in a landmark; its stories check the rest of its rules. reka-ui's toast viewport keeps
    // hidden `tabindex="0"` spans that hand the focus on as soon as it arrives, so it never rests in a hidden element.
    axe.exclude('[role="separator"]').exclude('[role="region"] > span[aria-hidden="true"][tabindex="0"]');

    const { violations } = await axe.analyze();
    const found = violations.flatMap(violation =>
        violation.nodes.map(
            node => `${violation.id}: ${node.target.join(' ')} — ${node.failureSummary ?? violation.help}`,
        ),
    );
    expect.soft(found, `axe on ${state}`).toEqual([]);

    if (buttonSizes) {
        await expectButtonSizes(page, state, within);
    }
}
