import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './PropertyValueButton.stories.jsx';

const { Gallery } = composeStories(stories);

test('a value is a button named by its property and value, opened by a click or from the keyboard', async () => {
    await Gallery.run();

    await userEvent.click(page.getByRole('button', { name: 'Labels: bug, calendar' }));
    await expect.element(page.getByTestId('opened')).toHaveTextContent('Opened: Labels');

    const status = page.getByRole('button', { name: 'Status: In progress' });
    await expect.element(status).toHaveAttribute('type', 'button');
    await expect.element(status).toHaveAttribute('aria-keyshortcuts', 'S');
    status.element().focus();
    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByTestId('opened')).toHaveTextContent('Opened: Status');
});
