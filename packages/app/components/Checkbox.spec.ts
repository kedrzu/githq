import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './Checkbox.stories.jsx';

const { Gallery } = composeStories(stories);

test('a click on its label or Space toggles it once', async () => {
    await Gallery.run();

    const another = page.getByRole('checkbox', { name: 'Create another' });
    await expect.element(another).not.toBeChecked();

    await userEvent.click(page.getByText('Create another', { exact: true }));
    await expect.element(another).toBeChecked();
    await expect.element(page.getByTestId('another')).toHaveTextContent('Create another: true');

    await userEvent.keyboard(' ');
    await expect.element(another).not.toBeChecked();
    await expect.element(page.getByTestId('another')).toHaveTextContent('Create another: false');
});

test('a partly chosen group reads as mixed', async () => {
    await Gallery.run();

    await expect
        .element(page.getByRole('checkbox', { name: 'skyline-labs · 2 of 312' }))
        .toHaveAttribute('aria-checked', 'mixed');
});
