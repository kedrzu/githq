import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './SettingsToggleCard.stories.js';

const { Off, WithLink } = composeStories(stories);

test('the switch is named by the title, described by the text, and a click anywhere on the card flips it', async () => {
    const onUpdate = vi.fn();
    await Off.run({ args: { ...Off.args, 'onUpdate:modelValue': onUpdate } });

    const toggle = page.getByRole('switch', { name: 'Setting' });
    await expect.element(toggle).not.toBeChecked();
    await expect.element(toggle).toHaveAccessibleDescription('What it does.');

    // The text lies under the Switch's hit area, so the click lands where a user's would: on the card.
    await userEvent.click(page.getByText('What it does.'), { force: true });
    expect(onUpdate).toHaveBeenLastCalledWith(true);
    await userEvent.click(page.getByRole('heading', { name: 'Setting' }), { force: true });
    expect(onUpdate).toHaveBeenCalledTimes(2);
});

test('the link opens without flipping the switch', async () => {
    const onUpdate = vi.fn();
    await WithLink.run({ args: { ...WithLink.args, 'onUpdate:modelValue': onUpdate } });
    const followed = vi.fn((event: MouseEvent) => event.preventDefault());
    document.addEventListener('click', followed, { once: true });

    await userEvent.click(page.getByRole('link', { name: 'Learn more' }));

    expect(followed).toHaveBeenCalledWith(expect.objectContaining({ target: page.getByRole('link').element() }));
    expect(onUpdate).not.toHaveBeenCalled();
});

test('Tab reaches the link, then the switch, with no stop for the card; Space on the switch flips it', async () => {
    const onUpdate = vi.fn();
    await WithLink.run({ args: { ...WithLink.args, 'onUpdate:modelValue': onUpdate } });

    await userEvent.tab();
    await expect.element(page.getByRole('link', { name: 'Learn more' })).toHaveFocus();
    await userEvent.tab();
    await expect.element(page.getByRole('switch', { name: 'Setting' })).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(onUpdate).toHaveBeenLastCalledWith(false);
});
