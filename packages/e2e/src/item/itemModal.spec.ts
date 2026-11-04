import type { Locator } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';

const ISSUE = 'Sign-in loops after the token expires';
const OTHER = 'Cache search results';

test('the modal takes focus itself, not its first button, and keeps the app under it out of reach while open', async ({
    page,
    github,
}) => {
    const { myWork, shell } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await item.arrangement('Modal').click();
    await page.keyboard.press('Escape');
    await expect(item.modal).toBeHidden();

    await myWork.row(ISSUE).click();
    await expect(item.modal).toBeVisible();
    await expect(item.modal).toBeFocused();
    await expect(item.menuButton).not.toBeFocused();
    // Under it, the app is inert: out of the tab order and of what screen readers see.
    await expect(shell.sidebar).toBeHidden();
    await expect(page.locator('[inert] nav')).toHaveCount(1);

    await page.keyboard.press('Tab');
    await expect(item.menuButton).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(item.modal).toBeHidden();
    await expect(shell.sidebar).toBeVisible();
    await expect(page.locator('[inert] nav')).toHaveCount(0);
});

test("the command menu opens over the modal, and what it opens takes the modal's place", async ({ page, github }) => {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);
    const menu = new CommandMenuHarness(page);
    await myWork.row(ISSUE).click();
    await item.arrangement('Modal').click();
    await expect(item.modal).toBeVisible();

    await menu.open();
    await expect(menu.root).toBeVisible();
    // On top: a click on its line reaches it, not the modal under it.
    await menu.field.pressSequentially(OTHER);
    await menu.option(new RegExp(OTHER)).click();
    await expect(menu.root).toBeHidden();
    await expect(item.title).toHaveText(OTHER);
});

test("in the modal J steps through the list, the list's selection following; the arrows leave the opened item where it is", async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);
    await myWork.row(OTHER).click();
    await item.arrangement('Modal').click();
    await expect(item.position).toHaveText('2 / 8');

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await expect(item.title).toHaveText(OTHER);
    await expect(item.position).toHaveText('2 / 8');

    await page.keyboard.press('j');
    await expect(item.title).toHaveText('Move the sidebar state to the store');
    await expect(item.position).toHaveText('3 / 8');
    await page.keyboard.press('Escape');
    await expect(item.modal).toBeHidden();
    await expect(myWork.selectedRow).toContainText('Move the sidebar state to the store');
});

test('the modal is widened and narrowed by dragging either edge, and keeps its width across reloads', async ({
    page,
    github,
}) => {
    await page.setViewportSize({ width: 2560, height: 1200 });
    const { myWork, shell } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await item.arrangement('Modal').click();
    await expect.poll(() => getWidth(item.modal)).toBe(1440);

    // Both edges move: the modal stays in the middle.
    await shell.drag(item.modalHandles.last(), 200);
    await expect.poll(() => getWidth(item.modal)).toBe(1840);
    await shell.drag(item.modalHandles.first(), 300);
    await expect.poll(() => getWidth(item.modal)).toBe(1240);
    // No narrower than its minimum.
    await shell.drag(item.modalHandles.first(), 600);
    await expect.poll(() => getWidth(item.modal)).toBe(720);

    await page.reload();
    await expect.poll(() => getWidth(item.modal)).toBe(720);

    // In a narrower window it fits the window.
    await page.setViewportSize({ width: 1440, height: 900 });
    await shell.drag(item.modalHandles.last(), 1000);
    await expect.poll(() => getWidth(item.modal)).toBe(1440 - 48);
});

async function getWidth(locator: Locator) {
    const box = await locator.boundingBox();
    return box ? Math.round(box.width) : null;
}
