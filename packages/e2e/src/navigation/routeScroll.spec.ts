import type { Locator } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';

// The screens scroll inside their own containers, out of the window's reach (`shell/routeScroll.ts`).

const ISSUE = 'Sign-in loops after the token expires';
const NEXT = 'Redirect once after sign-in';

test('another item opened over the list opens at the top, the list under it staying where it was', async ({
    page,
    github,
}) => {
    // Short enough for the item and the list to scroll.
    await page.setViewportSize({ width: 1280, height: 360 });
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);
    const list = page.locator('[data-route-scroll^="list:"]');

    await myWork.row(ISSUE).click();
    await expect(item.title).toHaveText(ISSUE);
    const listTop = await scrollDown(list);
    await scrollDown(item.content);

    await myWork.row(NEXT).click();
    await expect(item.title).toHaveText(NEXT);
    await expect.poll(() => getScrollTop(item.content)).toBe(0);
    expect(await getScrollTop(list)).toBe(listTop);
});

test("an item's link opens the other item at the top, and Back brings the first one back where it was", async ({
    page,
    github,
}) => {
    await page.setViewportSize({ width: 1280, height: 360 });
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);

    // The pull request closes the issue, and links to it.
    await myWork.row(NEXT).click();
    await item.arrangement('Full page').click();
    await expect(page).toHaveURL('/acme/web/pull/15');
    const top = await scrollDown(item.content);

    await item.root.getByRole('button', { name: ISSUE }).click();
    await expect(item.title).toHaveText(ISSUE);
    await expect.poll(() => getScrollTop(item.content)).toBe(0);

    await page.goBack();
    await expect(item.title).toHaveText(NEXT);
    await expect.poll(() => getScrollTop(item.content)).toBe(top);
});

test("Back from an item's page brings the list back where it was", async ({ page, github }) => {
    await page.setViewportSize({ width: 1280, height: 360 });
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);
    const list = page.locator('[data-route-scroll^="list:"]');

    const top = await scrollDown(list);
    await myWork.row(ISSUE).click();
    await item.arrangement('Full page').click();
    await expect(page).toHaveURL('/acme/web/issues/12');

    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect.poll(() => getScrollTop(list)).toBe(top);
});

/** Scrolls `container` as far down as it goes, and says where that is — never the top. */
async function scrollDown(container: Locator) {
    await container.evaluate(element => {
        element.scrollTop = element.scrollHeight;
    });
    const top = await getScrollTop(container);
    expect(top).toBeGreaterThan(0);
    return top;
}

function getScrollTop(container: Locator) {
    return container.evaluate(element => element.scrollTop);
}
