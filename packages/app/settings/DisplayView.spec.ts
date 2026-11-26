import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { matchText } from '@/testing/matchText.js';

import * as stories from './DisplayView.stories.js';

const { AnimationsOff, AnimationsOn, Phone } = composeStories(stories);

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

test('Display offers no choice of a layout: the Animations switch is its one control', async () => {
    await AnimationsOff.run();

    await expect.element(page.getByRole('switch', { name: 'Animations' })).toBeVisible();
    expect(page.getByRole('radio').elements()).toHaveLength(0);
    expect(page.getByRole('switch').elements()).toHaveLength(1);
    expect(page.getByRole('combobox').elements()).toHaveLength(0);
});

test('the computer shows the typography above Animations', async () => {
    await AnimationsOn.run();

    await expect.element(page.getByRole('region', { name: 'Typography' })).toBeVisible();
    await expect.element(page.getByRole('group', { name: 'Preset' })).toBeVisible();
});

test('in the phone layout Display shows no typography controls, only the Animations switch', async () => {
    await Phone.run();

    await expect.element(page.getByRole('switch', { name: 'Animations' })).toBeVisible();
    expect(page.getByRole('region', { name: 'Typography' }).elements()).toHaveLength(0);
    expect(page.getByRole('group', { name: 'Preset' }).elements()).toHaveLength(0);
    expect(page.getByRole('button').elements()).toHaveLength(0);
});
