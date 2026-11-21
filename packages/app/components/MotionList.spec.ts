import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { nextTick } from 'vue';

import * as stories from './MotionList.stories.js';

const { Animated, Still } = composeStories(stories);

test('with the animations off, an item removed leaves the list at once', async () => {
    await Still.run();

    await userEvent.click(page.getByRole('button', { name: 'Remove the first' }));

    expect(items()).toHaveLength(2);
});

test('with the animations on, an item removed fades out, keeping its width and hidden from assistive technology, then leaves the list', async () => {
    await Animated.run();

    const width = items()[0]?.getBoundingClientRect().width;
    // Clicked in the page, not through `userEvent`: its round trip can outlast the 150 ms fade, and only microtasks
    // run between this click and the checks below, so the leaving item can't be gone yet.
    page.getByRole('button', { name: 'Remove the first' })
        .element()
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(items()).toHaveLength(3);
    expect(items()[0]?.getBoundingClientRect().width).toBe(width);
    expect(items()[0]?.getAttribute('aria-hidden')).toBe('true');
    expect(items()[0]?.inert).toBe(true);
    await expect.poll(() => items().length).toBe(2);
});

function items() {
    return [...page.getByTestId('items').element().querySelectorAll('li')];
}
