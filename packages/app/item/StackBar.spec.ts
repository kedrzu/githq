import { assertValue } from '@nzyme/utils/assert.js';
import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { SYNC_ENGINE_STACK } from '@/testing/sampleStacks.js';

import * as stories from './StackBar.stories.js';

const { Phone, PhoneAtBase, RowsAway, RowsInView } = composeStories(stories);

const TOGGLE = /^Pull requests of\sthe stack: /u;

test('the squares follow the name and chevron 8px after them; the empty end of the bar toggles the rows too', async () => {
    await RowsAway.run();

    const toggle = page.getByRole('button', { name: TOGGLE }).element();
    const places = page.getByRole('list').element();
    expect(places.getBoundingClientRect().left - toggle.getBoundingClientRect().right).toBeCloseTo(8, 0);

    const bar = toggle.parentElement;
    const rest = bar?.lastElementChild;
    if (!bar || !rest) {
        throw new Error('The toggle is not in a bar.');
    }

    // The bar's end, left of its padding, is empty space.
    expect(places.getBoundingClientRect().right).toBeLessThan(bar.getBoundingClientRect().right - 100);
    // The story's own play already clicked the toggle once.
    const dropped = assertValue(RowsAway.args['onUpdate:dropped']);
    vi.mocked(dropped).mockClear();
    await userEvent.click(rest);
    expect(dropped).toHaveBeenCalledExactlyOnceWith(true);
});

test('with the rows in view the empty end of the bar toggles nothing', async () => {
    await RowsInView.run();

    const rest = page.getByRole('button', { name: TOGGLE }).element().parentElement?.lastElementChild;
    if (!rest) {
        throw new Error('The bar has no end.');
    }

    await userEvent.click(rest);
    expect(RowsInView.args['onUpdate:dropped']).not.toHaveBeenCalled();
});

test('mobile D29: on a phone ← opens the previous pull request (towards the base) and → the next; a tap on the rest drops the rows', async () => {
    await Phone.run();

    await expect.element(page.getByText('Stack · 6 of 10')).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Previous in the stack' }));
    await userEvent.click(page.getByRole('button', { name: 'Next in the stack' }));
    expect(vi.mocked(assertValue(Phone.args.onOpen)).mock.calls).toEqual([
        [SYNC_ENGINE_STACK[4]!.id],
        [SYNC_ENGINE_STACK[6]!.id],
    ]);

    // D48: the strip itself unfolds the stack, its rows in view or not.
    await userEvent.click(page.getByRole('button', { name: /^Stack · 6 of 10, Pull requests of\sthe stack: /u }));
    expect(Phone.args['onUpdate:dropped']).toHaveBeenCalledExactlyOnceWith(true);
    // No squares on a phone: the pips say it.
    expect(page.getByRole('list').query()).toBeNull();
});

test('on a phone, at the base of the stack there is nothing to step back to', async () => {
    await PhoneAtBase.run();

    await expect.element(page.getByText('Stack · 1 of 10')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Previous in the stack' })).toBeDisabled();
    await expect.element(page.getByRole('button', { name: 'Next in the stack' })).toBeEnabled();
});
