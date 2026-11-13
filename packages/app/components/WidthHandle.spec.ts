import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './WidthHandle.stories.js';

const { Centred, Squeezed } = composeStories(stories);

const left = page.getByRole('separator', { name: 'Resize the item' }).first();
const right = page.getByRole('separator', { name: 'Resize the item' }).last();

test('dragging an edge moves both by as much, so the dragged one stays under the pointer, and stops at the range', async () => {
    await page.viewport(1200, 800);
    await Centred.run();
    const handle = right.element();
    const box = getBox();
    const startEdge = box.getBoundingClientRect().right;

    const drag = press(handle);
    drag.moveBy(50);
    await expect.poll(() => box.getBoundingClientRect().width).toBe(700);
    expect(box.getBoundingClientRect().right).toBeCloseTo(startEdge + 50);
    expect(Centred.args.onResized).not.toHaveBeenCalled();

    drag.moveBy(1000);
    await expect.poll(() => box.getBoundingClientRect().width).toBe(1000);
    drag.moveBy(-1000);
    await expect.poll(() => box.getBoundingClientRect().width).toBe(400);
    drag.release();
    expect(Centred.args.onResized).toHaveBeenCalledOnce();
});

test('the left edge widens the box by being dragged left', async () => {
    await page.viewport(1200, 800);
    await Centred.run();
    const box = getBox();
    const startEdge = box.getBoundingClientRect().left;

    const drag = press(left.element());
    drag.moveBy(-30);
    await expect.poll(() => box.getBoundingClientRect().width).toBe(660);
    expect(box.getBoundingClientRect().left).toBeCloseTo(startEdge - 30);
    drag.release();
});

test('the arrow keys move the edge 20px outwards or inwards, resized when the key is released', async () => {
    await page.viewport(1200, 800);
    await Centred.run();
    const box = getBox();

    right.element().focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(() => box.getBoundingClientRect().width).toBe(640);
    expect(Centred.args.onResized).toHaveBeenCalledOnce();

    left.element().focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await expect.poll(() => box.getBoundingClientRect().width).toBe(560);
});

test('with more kept than there is room for, a key narrows from the width drawn', async () => {
    await page.viewport(1200, 800);
    await Squeezed.run();
    const box = getBox();
    await expect.poll(() => box.getBoundingClientRect().width).toBe(1000);

    right.element().focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect.poll(() => box.getBoundingClientRect().width).toBe(960);
});

function getBox() {
    return page.getByTestId('box').element();
}

/** Presses the primary button on `handle`, as the mouse does (pointer 1). */
function press(handle: Element) {
    const { left: x, top, height } = handle.getBoundingClientRect();
    const y = top + height / 2;
    const init = { pointerId: 1, button: 0, bubbles: true, clientY: y };
    handle.dispatchEvent(new PointerEvent('pointerdown', { ...init, clientX: x }));

    return {
        /** Moves the pointer `by` pixels from where it was pressed. */
        moveBy(by: number) {
            handle.dispatchEvent(new PointerEvent('pointermove', { ...init, clientX: x + by }));
        },
        release() {
            handle.dispatchEvent(new PointerEvent('pointerup', { ...init, clientX: x }));
        },
    };
}
