import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ContextMenu.stories.jsx';

const { PhoneRow, Row } = composeStories(stories);

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

test('on a phone its entries run from a menu at the bottom; × closes it', async () => {
    await PhoneRow.run();

    const sheet = page.getByRole('dialog', { name: 'Actions' });
    await expect.element(sheet.getByRole('menu')).toBeVisible();
    await userEvent.click(sheet.getByRole('button', { name: 'Close' }));
    await expect.element(sheet).not.toBeInTheDocument();

    await userEvent.click(page.getByTestId('row'), { button: 'right' });
    await userEvent.click(sheet.getByRole('menuitem', { name: 'Copy link' }));
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: copy');
    await expect.element(sheet).not.toBeInTheDocument();
});
