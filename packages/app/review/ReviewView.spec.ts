import { composeStories } from '@storybook/vue3-vite';
import { expect, onTestFinished, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { FakeReviewWriting } from '@/testing/FakeReviewWriting.js';
import type { FakeReviewResolve } from '@/testing/FakeReviewWriting.js';
import type { TrackingStore } from '@/tracking/TrackingStore.js';
import { pressWidthHandle } from '@/testing/pressWidthHandle.js';

import * as stories from './ReviewView.stories.js';

const { Files, Thread } = composeStories(stories);

/** `$color-current-tint`, as `ReviewComment.spec.ts` reads it. */
const CURRENT_TINT = 'rgba(123, 135, 247, 0.067)';
/** The comments of `Thread`'s thread: sofiab's, then the viewer's own. */
const FIRST = 'C_1';
const SECOND = 'C_2';

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

test("D44: ↓ moves the cursor from a thread's first comment to its second, tinted and aria-current; with the keys in a text field none is", async () => {
    await runThread();
    await userEvent.keyboard('n');
    await expect.poll(getCurrentComment).toBe(FIRST);

    await userEvent.keyboard('{ArrowDown}');
    await expect.poll(getCurrentComment).toBe(SECOND);
    expect(getComputedStyle(getCommentBox(SECOND)).backgroundColor).toBe(CURRENT_TINT);
    expect(getComputedStyle(getCommentBox(FIRST)).backgroundColor).toBe('rgba(0, 0, 0, 0)');

    // Its editor takes the keys: the cursor stays on the comment, untinted.
    await userEvent.keyboard('w');
    await expect.element(page.getByRole('textbox', { name: 'Edit comment' })).toHaveFocus();
    await expect.poll(getCurrentComment).toBeNull();
    expect(getComputedStyle(getCommentBox(SECOND)).backgroundColor).toBe('rgba(0, 0, 0, 0)');
});

test("W edits the viewer's own comment in place, the text cursor in it; on another's it does nothing", async () => {
    await runThread();
    await userEvent.keyboard('n');
    await expect.poll(getCurrentComment).toBe(FIRST);

    await userEvent.keyboard('w');
    expect(page.getByRole('textbox', { name: 'Edit comment' }).query()).toBeNull();
    expect(getCurrentComment()).toBe(FIRST);

    await userEvent.keyboard('{ArrowDown}');
    await expect.poll(getCurrentComment).toBe(SECOND);
    await userEvent.keyboard('w');
    const editor = page.getByRole('textbox', { name: 'Edit comment' });
    await expect.element(editor).toHaveFocus();
    expect(getCommentBox(SECOND).contains(editor.element())).toBe(true);
});

test("Q opens the thread's reply box with the comment quoted and the focus in it", async () => {
    const writing = await runThread();
    await userEvent.keyboard('n');
    await expect.poll(getCurrentComment).toBe(FIRST);

    await userEvent.keyboard('q');
    await expect.poll(() => writing.targets.map(target => target.threadId)).toEqual(['T_1']);
    const field = page.getByRole('textbox', { name: /^Reply to/u });
    await expect.element(field).toHaveFocus();
    await expect
        .element(field)
        .toHaveValue(expect.stringMatching(/^> What happens when the same workout is edited twice\?/u));
});

test(". opens the current comment's menu (Edit there: the viewer's own, not sofiab's), its Edit and Quote reply showing W and Q", async () => {
    await runThread();
    await userEvent.keyboard('n');
    await userEvent.keyboard('{ArrowDown}');
    await expect.poll(getCurrentComment).toBe(SECOND);

    await userEvent.keyboard('.');
    await expect.element(page.getByRole('menuitem', { name: /^Edit/u })).toHaveAttribute('aria-keyshortcuts', 'W');
    await expect
        .element(page.getByRole('menuitem', { name: /^Quote reply/u }))
        .toHaveAttribute('aria-keyshortcuts', 'Q');
});

test('the command menu lists Edit comment, Quote reply and Comment actions on the current comment; Edit comment opens its editor', async () => {
    await runThread();
    await userEvent.keyboard('n');
    await userEvent.keyboard('{ArrowDown}');
    await expect.poll(getCurrentComment).toBe(SECOND);

    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}');
    const menu = page.getByRole('listbox', { name: 'Command menu' });
    await expect.element(menu.getByRole('option', { name: /^Edit comment/u })).toBeVisible();
    await expect.element(menu.getByRole('option', { name: /^Quote reply/u })).toBeVisible();
    await expect.element(menu.getByRole('option', { name: /^Comment actions/u })).toBeVisible();

    await userEvent.click(menu.getByRole('option', { name: /^Edit comment/u }));
    const editor = page.getByRole('textbox', { name: 'Edit comment' });
    await expect.element(editor).toHaveFocus();
    expect(getCommentBox(SECOND).contains(editor.element())).toBe(true);
});

test("N lands on a thread's first comment, ↑ from below on its last; R and H there act on its thread", async () => {
    const writing = await runThread();
    await userEvent.keyboard('n');
    await expect.poll(getCurrentComment).toBe(FIRST);

    // Past the thread to the line under it, and back up.
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expect.poll(getCurrentComment).toBeNull();
    await userEvent.keyboard('{ArrowUp}');
    await expect.poll(getCurrentComment).toBe(SECOND);

    await userEvent.keyboard('h');
    const resolved: FakeReviewResolve[] = [{ threadId: 'T_1', resolved: true }];
    await expect.poll(() => writing.resolved).toEqual(resolved);

    await userEvent.keyboard('r');
    await expect.poll(() => writing.targets.map(target => target.threadId)).toEqual(['T_1']);
    await expect.element(page.getByRole('textbox', { name: /^Reply to/u })).toHaveFocus();
});

/** `Thread` in a window wide enough for the diff beside the file list, and the writing it writes through. */
async function runThread() {
    await page.viewport(1200, 900);
    onTestFinished(() => page.viewport(414, 896));
    const writing = new FakeReviewWriting();
    await Thread.run({ parameters: { ...Thread.parameters, writing } });
    await expect.element(page.getByText('Both are kept on purpose.')).toBeVisible();
    return writing;
}

/** The comment the cursor is on, by its `aria-current`; `null` while none is marked. */
function getCurrentComment() {
    const current = document.querySelector('[data-cursor-comment][aria-current="true"]');
    return current?.getAttribute('data-cursor-comment') ?? null;
}

function getCommentBox(id: string) {
    return assertElement(document.querySelector(`[data-cursor-comment="${id}"]`));
}

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
