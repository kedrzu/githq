import type { Locator } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';

const ISSUE = 'Sign-in loops after the token expires';
/** The panel's border, left of the item in it. */
const BORDER = 1;
/** What the list keeps of the window, at least, beside the panel. */
const LIST_MIN = 400;

test('the sidebar and the item panel are resized by dragging their edges, and keep their widths across reloads and the rail', async ({
    page,
    github,
}) => {
    const { shell, myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);

    await expect.poll(() => getWidth(shell.sidebar)).toBe(236);
    await shell.drag(shell.sidebarHandle, 64);
    await expect.poll(() => getWidth(shell.sidebar)).toBe(300);

    await myWork.row(ISSUE).click();
    await expect(item.title).toHaveText(ISSUE);
    // Opening the panel lays the panels out anew: the sidebar keeps the width it was given.
    await expect.poll(() => getWidth(shell.sidebar)).toBe(300);
    await expect.poll(() => getWidth(item.root)).toBe(560 - BORDER);
    await shell.drag(shell.panelHandle, 100);
    await expect.poll(() => getWidth(item.root)).toBe(460 - BORDER);

    // The rail is as narrow as ever, and expanded the sidebar is as wide as it was; the panel stays as it is.
    await page.keyboard.press('[');
    await expect.poll(() => getWidth(shell.sidebar)).toBe(56);
    await expect.poll(() => getWidth(item.root)).toBe(460 - BORDER);
    await page.keyboard.press('[');
    await expect.poll(() => getWidth(shell.sidebar)).toBe(300);
    await expect.poll(() => getWidth(item.root)).toBe(460 - BORDER);

    await page.reload();
    await expect(item.title).toHaveText(ISSUE);
    await expect.poll(() => getWidth(shell.sidebar)).toBe(300);
    await expect.poll(() => getWidth(item.root)).toBe(460 - BORDER);

    // Closed, the panel gives its width to the list; the sidebar keeps its own.
    await page.keyboard.press('Escape');
    await expect(item.root).toBeHidden();
    await expect.poll(() => getWidth(shell.sidebar)).toBe(300);
});

test('on a wide window the item panel grows as far as the list keeps its minimum, and a narrower window squeezes the panel, not the sidebar', async ({
    page,
    github,
}) => {
    await page.setViewportSize({ width: 3840, height: 1200 });
    const { shell, myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await expect(item.title).toHaveText(ISSUE);

    await shell.drag(shell.panelHandle, -3000);
    await expect.poll(() => getWidth(item.root)).toBe(3840 - 236 - LIST_MIN - BORDER);
    await expect.poll(() => getWidth(shell.sidebar)).toBe(236);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect.poll(() => getWidth(item.root)).toBe(1440 - 236 - LIST_MIN - BORDER);
    await expect.poll(() => getWidth(shell.sidebar)).toBe(236);

    // Back on the wide window, the panel is as wide as the user left it.
    await page.setViewportSize({ width: 3840, height: 1200 });
    await page.reload();
    await expect(item.title).toHaveText(ISSUE);
    await expect.poll(() => getWidth(item.root)).toBe(3840 - 236 - LIST_MIN - BORDER);
});

async function getWidth(locator: Locator) {
    const box = await locator.boundingBox();
    return box ? Math.round(box.width) : null;
}
