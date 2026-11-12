import { expect, test } from '../fixtures.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';
import { getScrollTop } from '../utils/getScrollTop.js';
import { scrollDown } from '../utils/scrollDown.js';

// An item opens in the panel; Enter on its row again, "Open full screen" or ⇧Enter expand it to its page, and Escape,
// "Back to the panel" or ⇧Enter step back to the panel (`OpenedItem.vue`).

const ISSUE = 'Sign-in loops after the token expires';
const PANEL = '/?pane=issue&issue=acme%7Cweb%7C12';
const PAGE = '/acme/web/issues/12';

test('Enter on the open row expands the item to its page; Escape goes back to the panel, scrolled where it was', async ({
    page,
    github,
}) => {
    // Short enough for the item to scroll.
    await page.setViewportSize({ width: 1280, height: 360 });
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);

    await myWork.row(ISSUE).click();
    await expect(page).toHaveURL(PANEL);
    const top = await scrollDown(item.content);

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(PAGE);
    await expect(item.backToPanelButton).toBeVisible();
    await expect.poll(() => getScrollTop(item.content)).toBe(0);

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(PANEL);
    await expect(item.title).toHaveText(ISSUE);
    await expect.poll(() => getScrollTop(item.content)).toBe(top);
    await expect(myWork.selectedRow).toContainText(ISSUE);

    // Escape in the panel closes it.
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL('/');
    await expect(item.root).toBeHidden();
});

test('Shift+Enter toggles the panel and the page', async ({ page, github }) => {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);

    await myWork.row(ISSUE).click();
    await expect(item.fullScreenButton).toBeVisible();
    await page.keyboard.press('Shift+Enter');
    await expect(page).toHaveURL(PAGE);
    await page.keyboard.press('Shift+Enter');
    await expect(page).toHaveURL(PANEL);
    await expect(item.fullScreenButton).toBeVisible();
});

test('a reload of an expanded page keeps "Back to the panel" returning to the panel', async ({ page, github }) => {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);

    await myWork.row(ISSUE).click();
    await item.fullScreenButton.click();
    await expect(page).toHaveURL(PAGE);

    await page.reload();
    await expect(item.title).toHaveText(ISSUE);
    await item.backToPanelButton.click();
    await expect(page).toHaveURL(PANEL);
    await expect(item.title).toHaveText(ISSUE);
    await expect(myWork.selectedRow).toContainText(ISSUE);
});

test('a page opened by its address: "Back to the panel" puts the item in the panel over the list, Escape closes it to the list', async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);

    await page.goto(PAGE);
    await expect(item.title).toHaveText(ISSUE);
    await item.backToPanelButton.click();
    await expect(page).toHaveURL(PANEL);
    await expect(item.title).toHaveText(ISSUE);
    await expect(myWork.selectedRow).toContainText(ISSUE);

    await page.goto(PAGE);
    await expect(item.title).toHaveText(ISSUE);
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL('/');
    await expect(item.root).toBeHidden();
});
