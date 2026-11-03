import AxeBuilder from '@axe-core/playwright';
import { ACCESSIBILITY_TAGS } from '@githq/app/testing/accessibilityTags.js';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Checks the page as it stands now with axe, under the same tags as the stories (`.storybook/preview.ts`). Soft, so one
 * walk through a screen reports all of its states; each violation shows its rule, its elements and why.
 */
export async function expectAccessible(page: Page, state: string): Promise<void> {
    const { violations } = await new AxeBuilder({ page }).withTags(ACCESSIBILITY_TAGS).analyze();
    const found = violations.flatMap(violation =>
        violation.nodes.map(
            node => `${violation.id}: ${node.target.join(' ')} — ${node.failureSummary ?? violation.help}`,
        ),
    );
    expect.soft(found, `axe on ${state}`).toEqual([]);
}
