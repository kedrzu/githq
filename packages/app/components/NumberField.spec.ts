import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './NumberField.stories.jsx';

const { Estimate } = composeStories(stories);

test('a number typed is the value, and an emptied field holds nothing rather than 0', async () => {
    await Estimate.run();

    const estimate = page.getByRole('spinbutton', { name: 'Estimate' });
    await expect.element(estimate).toHaveValue(3);
    await expect.element(estimate).toHaveAccessibleDescription('In points.');

    await userEvent.clear(estimate);
    await expect.element(page.getByTestId('value')).toHaveTextContent('Value: none');
    await expect.element(estimate).toHaveValue(null);

    await userEvent.type(estimate, '2.5');
    await expect.element(page.getByTestId('value')).toHaveTextContent('Value: 2.5');
});
