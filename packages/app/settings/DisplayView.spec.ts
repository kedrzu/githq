import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { matchText } from '@/testing/matchText.js';

import * as stories from './DisplayView.stories.js';

const { AnimationsOff } = composeStories(stories);

test('the animations switch is named, described by its text, shows the model and flips on click and Space', async () => {
    const onUpdate = vi.fn();
    await AnimationsOff.run({ args: { ...AnimationsOff.args, 'onUpdate:animations': onUpdate } });

    const animations = page.getByRole('switch', { name: 'Animations' });
    await expect.element(animations).not.toBeChecked();
    await expect
        .element(animations)
        .toHaveAccessibleDescription(
            matchText(
                "Short fades and slides show where a menu or window comes from, so the screen doesn't jump. Turn them off and everything appears at once.",
            ),
        );

    await userEvent.click(animations);
    expect(onUpdate).toHaveBeenLastCalledWith(true);

    await expect.element(animations).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(onUpdate).toHaveBeenCalledTimes(2);
});
