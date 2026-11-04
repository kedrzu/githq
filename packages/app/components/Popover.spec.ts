import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './Popover.stories.jsx';

const { LabelsPicker, TriggerSaysOtherwise } = composeStories(stories);

test('opens from its trigger as a named dialog with focus inside; Escape closes it and focus returns', async () => {
    await LabelsPicker.run();

    const trigger = page.getByRole('button', { name: 'Labels' });
    await userEvent.click(trigger);
    const panel = page.getByRole('dialog', { name: 'Labels' });
    await expect.element(panel).toBeVisible();
    await expect.element(panel.getByRole('checkbox', { name: 'bug' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    await expect.element(panel).not.toBeInTheDocument();
    await expect.element(trigger).toHaveFocus();
});

test('its label names it, not a trigger saying something else, through a re-render too', async () => {
    await TriggerSaysOtherwise.run();

    await userEvent.click(page.getByRole('button', { name: 'Split' }));

    const panel = page.getByRole('dialog', { name: 'View options' });
    await expect.element(panel).toBeVisible();
    await expect.element(page.getByRole('dialog', { name: 'Split' })).not.toBeInTheDocument();

    await userEvent.click(panel.getByRole('checkbox', { name: 'Hide whitespace' }));
    await expect.element(page.getByRole('dialog', { name: 'View options' })).toBeVisible();
});
