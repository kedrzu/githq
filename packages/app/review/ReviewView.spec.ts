import { composeStories } from '@storybook/vue3-vite';
import { expect, onTestFinished, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import type { TrackingStore } from '@/tracking/TrackingStore.js';
import { pressWidthHandle } from '@/testing/pressWidthHandle.js';

import * as stories from './ReviewView.stories.js';

const { Files } = composeStories(stories);

test("by default the diff takes the whole width; a kept maximum centres it in a box, the rows inside and the gaps the diff's, and the side columns narrow or widen it keeping nothing", async () => {
    const tracking = await runFiles();
    const list = getDiff();
    const edges = page.getByRole('separator', { name: 'Resize the diff' });
    await expect.poll(() => edges.elements().length).toBe(2);
    expect(getSpace()).toEqual({ left: 0, right: 0 });
    expect(tracking.reviewDiffWidth).toBeNull();

    // Changed elsewhere (another device), the box follows; the rows keep to it, the gaps beside them are the list's.
    tracking.setMaxWidth('reviewDiffWidth', 1000);
    await expect.poll(() => getBox().width).toBe(1000);
    expectEqualGaps();
    const row = assertElement(list.lastElementChild?.firstElementChild);
    await expect.poll(() => row.getBoundingClientRect().left).toBe(getBox().left);
    expect(row.getBoundingClientRect().right).toBe(getBox().right);
    const gap = document.elementFromPoint(list.getBoundingClientRect().left + 10, row.getBoundingClientRect().top + 5);
    expect(list.contains(gap) && !row.contains(gap)).toBe(true);

    // The file list gone, the box keeps its width in the wider room; the conversation shown, there is no room for it.
    await userEvent.click(page.getByRole('button', { name: 'File list', exact: true }));
    await expect.poll(getSpace).not.toEqual({ left: 0, right: 0 });
    expect(getBox().width).toBe(1000);
    expectEqualGaps();
    await userEvent.click(page.getByRole('button', { name: 'Conversation', exact: true }));
    await userEvent.click(page.getByRole('button', { name: 'File list', exact: true }));
    await expect.poll(() => getBox().width).toBe(list.clientWidth);
    expect(list.clientWidth).toBeLessThan(1000);
    await userEvent.click(page.getByRole('button', { name: 'Conversation', exact: true }));
    await expect.poll(() => getBox().width).toBe(1000);
    expect(tracking.reviewDiffWidth).toBe(1000);
});

test('the edges take no focus from the mouse and keep nothing for a click; Tab reaches them and an arrow narrows both sides, kept; dragged to the edge it keeps "full"', async () => {
    const tracking = await runFiles();
    const edges = page.getByRole('separator', { name: 'Resize the diff' });
    await expect.poll(() => edges.elements().length).toBe(2);
    const room = getDiff().clientWidth;

    await userEvent.click(edges.last());
    expect(document.activeElement).not.toBe(edges.last().element());
    expect(tracking.reviewDiffWidth).toBeNull();

    assertElement(edges.first().element()).focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(edges.last().element());
    await userEvent.keyboard('{ArrowLeft}');
    await expect.poll(() => getBox().width).toBe(room - 40);
    expectEqualGaps();
    expect(tracking.reviewDiffWidth).toBe(room - 40);

    const drag = pressWidthHandle(edges.last().element());
    drag.moveBy(100);
    await expect.poll(() => getBox().width).toBe(room);
    drag.release();
    expect(tracking.reviewDiffWidth).toBe('full');
});

/** `Files` in a window wide enough for a box beside both side columns, and the user's settings once read. */
async function runFiles() {
    await page.viewport(1600, 900);
    onTestFinished(() => page.viewport(414, 896));
    const settings = Promise.withResolvers<TrackingStore>();
    await Files.run({ parameters: { ...Files.parameters, onTracking: settings.resolve } });
    return await settings.promise;
}

function getDiff() {
    return assertElement(page.getByRole('region', { name: 'Changes' }).element());
}

/** The diff's box: the edges' parent. */
function getBox() {
    const edge = page.getByRole('separator', { name: 'Resize the diff' }).first().element();
    return assertElement(edge.parentElement).getBoundingClientRect();
}

/** The gaps beside the box, inside the list's scrollbar. */
function getSpace() {
    const list = getDiff();
    const left = list.getBoundingClientRect().left;
    const box = getBox();
    return { left: box.left - left, right: left + list.clientWidth - box.right };
}

function expectEqualGaps() {
    const { left, right } = getSpace();
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
}

function assertElement(element: Element | null | undefined) {
    if (!(element instanceof HTMLElement)) {
        throw new TypeError('Not an HTML element');
    }

    return element;
}
