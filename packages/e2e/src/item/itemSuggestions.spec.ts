import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';

const ISSUE = 'Sign-in loops after the token expires';

for (const arrangement of ['panel', 'page'] as const) {
    for (const trigger of ['@', '#'] as const) {
        test(`in the ${arrangement} the ${trigger} menu opens under the caret, within the item's content`, async ({
            page,
            github,
        }) => {
            await page.setViewportSize({ width: 1100, height: 760 });
            const item = await openItem(page, github, arrangement);
            github.graphql('ReferenceSearch', {
                search: {
                    nodes: [1, 12, 123, 1234].map(number => ({
                        __typename: 'Issue' as const,
                        number,
                        title: `A title long enough to fill the menu's row with words, number ${number}`,
                        issueState: 'OPEN' as const,
                        stateReason: null,
                    })),
                },
            });
            await item.commentBox.pressSequentially(
                `Thanks, this is what I see here too, so see ${trigger === '#' ? '#1' : '@'}`,
            );

            const menu = page.getByRole('listbox').locator('..');
            await expect(menu).toBeVisible();
            const content = await getBox(item.content);
            const box = await getBox(menu);
            const write = await getBox(item.root.getByRole('tab', { name: 'Write' }).last());
            // Never over the editor's tabs: under the caret, or over it where there is no room below.
            expect(box.y >= write.y + write.height || box.y + box.height <= write.y).toBe(true);
            expect(box.x).toBeGreaterThanOrEqual(content.x);
            expect(box.x + box.width).toBeLessThanOrEqual(content.x + content.width);
            expect(box.y).toBeGreaterThanOrEqual(content.y);
            expect(box.y + box.height).toBeLessThanOrEqual(content.y + content.height);
        });
    }
}

async function openItem(page: Page, github: Parameters<typeof openMyWork>[1], arrangement: 'page' | 'panel') {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    if (arrangement === 'page') {
        await item.fullScreenButton.click();
        // The panel's comment box goes as the page comes: typing waits for the page's.
        await expect(page).toHaveURL('/acme/web/issues/12');
    }

    await expect(item.commentBox).toBeVisible();
    return item;
}

async function getBox(locator: Locator) {
    const box = await locator.boundingBox();
    if (!box) {
        throw new Error('Not on screen.');
    }

    return box;
}
