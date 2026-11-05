import AxeBuilder from '@axe-core/playwright';
import { ACCESSIBILITY_TAGS } from '@githq/app/testing/accessibilityTags.js';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Checks the page as it stands now with axe, under the same tags as the stories (`.storybook/preview.ts`). Soft, so one
 * walk through a screen reports all of its states; each violation shows its rule, its elements and why.
 *
 * @param within A CSS selector, for a layer that holds the focus and hides the page from assistive technology (a menu, a
 * popover): only it is checked then. The page behind it has its own state in the walk.
 */
export async function expectAccessible(page: Page, state: string, within?: string): Promise<void> {
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
}
