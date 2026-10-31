import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './DateField.stories.jsx';

const { DueDate } = composeStories(stories);

test('the day typed is the value, at its local midnight, and an emptied field holds nothing', async () => {
    await DueDate.run();

    const due = page.getByLabelText('Due');
    await expect.element(due).toHaveValue('2026-11-03');
    await expect.element(due).toHaveAccessibleDescription('When it ships.');

    await userEvent.fill(due, '2026-12-24');
    await expect.element(page.getByTestId('value')).toHaveTextContent('Value: 2026-12-24 0h');
    await expect.element(due).toHaveValue('2026-12-24');

    await userEvent.clear(due);
    await expect.element(page.getByTestId('value')).toHaveTextContent('Value: none');
});
