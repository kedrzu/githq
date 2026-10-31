import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ContextMenu.stories.jsx';

const { Row } = composeStories(stories);

test('a right-click opens it, ↓ and Enter pick an item, and it closes', async () => {
    await Row.run();

    await userEvent.click(page.getByTestId('row'), { button: 'right' });
    await expect.element(page.getByRole('menu')).toBeVisible();
    await expect
        .element(page.getByRole('menuitem', { name: 'Open on GitHub' }))
        .toHaveAttribute('aria-keyshortcuts', 'O');

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: copy');
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
});

test('Escape closes it without picking anything', async () => {
    await Row.run();

    await userEvent.click(page.getByTestId('row'), { button: 'right' });
    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: nothing');
});
