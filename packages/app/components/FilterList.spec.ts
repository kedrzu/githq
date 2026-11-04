import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './FilterList.stories.jsx';

const { Filtered } = composeStories(stories);

test('typed text narrows the rows and Enter picks the best match at once', async () => {
    await Filtered.run();

    await expect.element(page.getByRole('textbox', { name: 'Filter fruit…' })).toHaveFocus();
    await userEvent.keyboard('ap{Enter}');
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: apple');
});

test('↓ moves the highlight past a disabled row, and nothing matching says so', async () => {
    await Filtered.run();

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: cherry');

    await userEvent.keyboard('zzz');
    await expect.element(page.getByText('Nothing matches')).toBeVisible();
});

test('↑ on the first row lands on the last, ↓ on the last on the first, skipping a disabled last row', async () => {
    await Filtered.run();

    await userEvent.keyboard('{ArrowUp}');
    await expect.element(page.getByRole('option', { name: /Cherry/u })).toHaveAttribute('data-highlighted');
    await expect.element(page.getByRole('textbox', { name: 'Filter fruit…' })).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: apple');

    await userEvent.keyboard('{ArrowUp}{Enter}');
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: cherry');
});
