import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { assert } from '@nzyme/utils/assert.js';

import * as stories from './FilterList.stories.jsx';

const { Filtered } = composeStories(stories);

test('typed text narrows the rows and Enter picks the best match at once', async () => {
    await Filtered.run();

    await expect.element(page.getByRole('textbox', { name: 'Filter fruit…' })).toHaveFocus();
    await userEvent.keyboard('ap{Enter}');
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: apple');
});

test('↓ moves the highlight past a disabled row, and nothing matching says so', async () => {
    await Filtered.run();

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: cherry');

    await userEvent.keyboard('zzz');
    await expect.element(page.getByText('Nothing matches')).toBeVisible();
});

test('↑ on the first row lands on the last, ↓ on the last on the first, skipping a disabled last row', async () => {
    await Filtered.run();

    await userEvent.keyboard('{ArrowUp}');
    await expect.element(page.getByRole('option', { name: /Cherry/u })).toHaveAttribute('data-highlighted');
    await expect.element(page.getByRole('textbox', { name: 'Filter fruit…' })).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: apple');

    await userEvent.keyboard('{ArrowUp}{Enter}');
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: cherry');
});

test('rows shrinking out from under a resting pointer keep the best match highlighted', async () => {
    await Filtered.run();

    // The pointer rests on the last row; typing narrows the list so that it no longer reaches the pointer.
    await userEvent.hover(page.getByRole('option', { name: /Date/u }));
    await userEvent.keyboard('ap');
    await expect.element(page.getByRole('option', { name: /Apple/u })).toHaveAttribute('data-highlighted');
});

test('a finger moving over the rows highlights none of them; a mouse does', async () => {
    await Filtered.run();
    const apple = page.getByRole('option', { name: /Apple/u });
    const cherry = page.getByRole('option', { name: /Cherry/u });
    await expect.element(apple).toHaveAttribute('data-highlighted');

    cherry.element().dispatchEvent(new PointerEvent('pointermove', { pointerType: 'touch', bubbles: true }));
    await expect.element(apple).toHaveAttribute('data-highlighted');
    await expect.element(cherry).not.toHaveAttribute('data-highlighted');

    cherry.element().dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', bubbles: true }));
    await expect.element(cherry).toHaveAttribute('data-highlighted');
});

test('a finger lifting off a scrolled list leaves the highlight and the scroll as they were', async () => {
    await Filtered.run();
    const apple = page.getByRole('option', { name: /Apple/u });
    await expect.element(apple).toHaveAttribute('data-highlighted');

    // A list too short for its rows, scrolled past the highlighted first row.
    const list = page.getByRole('listbox', { name: 'Fruit' }).element();
    assert(list instanceof HTMLElement);
    list.style.maxHeight = '60px';
    list.scrollTop = list.scrollHeight;
    const scrolled = list.scrollTop;
    expect(scrolled).toBeGreaterThan(0);

    // The list's root, around the filter's line and the scrolling box: where reka-ui listens for the pointer leaving.
    list.parentElement!.parentElement!.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'touch' }));

    await expect.element(apple).toHaveAttribute('data-highlighted');
    expect(list.scrollTop).toBe(scrolled);
});
