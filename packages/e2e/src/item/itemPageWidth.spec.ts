import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';
import { getSettingsWrites } from '../settings/answerSettingsRepository.js';
import type { SettingsRepository } from '../settings/answerSettingsRepository.js';
import { turnOnSaving } from '../settings/turnOnSaving.js';

// On its page in two columns, an item stands in a centred box whose edges resize it symmetrically; the width is a
// maximum kept as `itemPageWidth` in the synced settings (`ItemView.vue`, `useMaxWidth`).

const ISSUE = 'Sign-in loops after the token expires';
const PAGE = '/acme/web/issues/12';
/** Summary 440 + reading 920 + the columns' insets 2 × 32: the box with nothing chosen. */
const DEFAULT_WIDTH = 1424;

test.use({ viewport: { width: 1920, height: 900 } });

test("dragging the item page's edge saves its width to the settings file, and a page opened with another width in the file is drawn at it", async ({
    page,
    github,
}) => {
    await openMyWork(page, github, createSampleMyWork().world);
    const repository = await turnOnSaving(page, github, { exists: false, file: null });
    const item = await openPage(page);
    await expect.poll(() => getWidth(item.pageBox)).toBe(DEFAULT_WIDTH);

    // Both edges move: 100 px in on the right takes 200 px off the box.
    await new AppShellHarness(page).drag(item.pageEdge('right'), -100);

    await expect.poll(() => getWidth(item.pageBox)).toBe(DEFAULT_WIDTH - 200);
    await expect.poll(() => readSettings(repository)).toMatchObject({ itemPageWidth: DEFAULT_WIDTH - 200 });

    // Another device writes a width: the page opened next is drawn at it.
    writeSettings(repository, { itemPageWidth: 1100 });
    await page.reload();
    await expect(item.title).toHaveText(ISSUE);
    await expect.poll(() => getWidth(item.pageBox)).toBe(1100);
});

test('a saved width wider than the window fills it, and the window widened again brings the saved width back, the file untouched', async ({
    page,
    github,
}) => {
    await openMyWork(page, github, createSampleMyWork().world);
    const repository = await turnOnSaving(page, github, {
        exists: true,
        file: {
            text: JSON.stringify({ version: 1, repositories: [], projects: [], itemPageWidth: 1600 }),
            sha: 'saved',
        },
    });
    const item = await openPage(page);
    await expect.poll(() => getWidth(item.pageBox)).toBe(1600);
    const file = repository.file;
    const writes = getSettingsWrites(github).length;

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect.poll(() => getRoomLeft(item)).toBe(0);
    expect(await getRoom(item)).toBeLessThan(1600);

    await page.setViewportSize({ width: 1920, height: 900 });
    await expect.poll(() => getWidth(item.pageBox)).toBe(1600);
    expect(repository.file).toBe(file);
    expect(getSettingsWrites(github)).toHaveLength(writes);
});

test('the item page dragged out to the whole width saves "full", and then fills a wider window too', async ({
    page,
    github,
}) => {
    await openMyWork(page, github, createSampleMyWork().world);
    const repository = await turnOnSaving(page, github, { exists: false, file: null });
    const item = await openPage(page);
    await expect.poll(() => getWidth(item.pageBox)).toBe(DEFAULT_WIDTH);

    await new AppShellHarness(page).drag(item.pageEdge('right'), 1000);

    await expect.poll(() => getRoomLeft(item)).toBe(0);
    await expect.poll(() => readSettings(repository)).toMatchObject({ itemPageWidth: 'full' });

    await page.setViewportSize({ width: 2560, height: 900 });
    await expect.poll(async () => (await getRoom(item)) > 2000).toBe(true);
    await expect.poll(() => getRoomLeft(item)).toBe(0);
});

/** Opens the issue on its own page and waits for its centred box. */
async function openPage(page: Page) {
    const item = new ItemViewHarness(page);
    await page.goto(PAGE);
    await expect(item.title).toHaveText(ISSUE);
    await expect(item.pageBox).toBeVisible();
    return item;
}

/** The width there is for the page's box: the columns' scroll inside its scrollbar. */
async function getRoom(item: ItemViewHarness) {
    return await item.columns.evaluate(columns => columns.clientWidth);
}

/** How much wider the room is than the page's box, read at once: 0 when the box fills it. */
async function getRoomLeft(item: ItemViewHarness) {
    const [room, width] = await Promise.all([getRoom(item), getWidth(item.pageBox)]);
    return width === null ? null : room - width;
}

async function getWidth(locator: Locator) {
    const box = await locator.boundingBox();
    return box ? Math.round(box.width) : null;
}

function readSettings(repository: SettingsRepository): unknown {
    return repository.file && JSON.parse(repository.file.text);
}

/** Changes the file as another device would: `changes` over what it holds, as a new version. */
function writeSettings(repository: SettingsRepository, changes: Record<string, unknown>) {
    const { file } = repository;
    if (!file) {
        throw new Error('The settings file is not there');
    }

    const text = JSON.stringify({ ...JSON.parse(file.text), ...changes });
    repository.file = { text, sha: `${file.sha}-elsewhere` };
}
