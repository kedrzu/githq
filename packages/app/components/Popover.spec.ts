import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './Popover.stories.jsx';

const { LabelsPicker } = composeStories(stories);

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
