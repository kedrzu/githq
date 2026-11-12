import { expect, test } from '../fixtures.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';
import { getScrollTop } from '../utils/getScrollTop.js';
import { scrollDown } from '../utils/scrollDown.js';

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
    await item.fullScreenButton.click();
    await expect(page).toHaveURL('/acme/web/pull/15');
    // The page of a 1280px window has two columns: the link (what it closes) in the summary, the thread beside it.
    const link = item.summary.getByRole('button', { name: ISSUE });
    await scrollDown(item.summary);
    const timelineTop = await scrollDown(item.timeline);
    // Maybe out of view: the click would scroll to it first, after the summary's top was read.
    await link.scrollIntoViewIfNeeded();
    const summaryTop = await getScrollTop(item.summary);
    expect(summaryTop).toBeGreaterThan(0);

    await link.click();
    await expect(item.title).toHaveText(ISSUE);
    await expect.poll(() => getScrollTop(item.summary)).toBe(0);
    await expect.poll(() => getScrollTop(item.timeline)).toBe(0);

    await page.goBack();
    await expect(item.title).toHaveText(NEXT);
    await expect.poll(() => getScrollTop(item.summary)).toBe(summaryTop);
    await expect.poll(() => getScrollTop(item.timeline)).toBe(timelineTop);
});

test("Back from an item's page, then from the panel it was expanded from, brings the list back where it was", async ({
    page,
    github,
}) => {
    // A slow machine: "my work" is a chunk of its own, so its list comes after the router has scrolled the screen.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 10 });
    await page.setViewportSize({ width: 1280, height: 360 });
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);
    const list = page.locator('[data-route-scroll^="list:"]');

    const top = await scrollDown(list);
    await myWork.row(ISSUE).click();
    await item.fullScreenButton.click();
    await expect(page).toHaveURL('/acme/web/issues/12');

    await page.goBack();
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C12');
    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect.poll(() => getScrollTop(list)).toBe(top);
});
