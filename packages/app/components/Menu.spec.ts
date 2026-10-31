import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './Menu.stories.jsx';

const { Actions, Choice } = composeStories(stories);

test('works from the keyboard: Enter opens, ↓ moves past what is not available, Enter picks, focus returns', async () => {
    await Actions.run();

    const trigger = page.getByRole('button', { name: 'Actions' });
    await userEvent.keyboard('{Tab}');
    await expect.element(trigger).toHaveFocus();
    // While the menu is open the rest of the page is hidden from the accessibility tree, the trigger too.
    const triggerElement = trigger.element();

    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByRole('menu')).toBeVisible();
    expect(triggerElement.getAttribute('aria-expanded')).toBe('true');
    await expect.element(page.getByRole('menuitem', { name: 'Open on GitHub' })).toHaveFocus();

    // Down to "Copy link"; the disabled "Close issue" after it is skipped, so focus stays.
    await userEvent.keyboard('{ArrowDown}');
    await expect.element(page.getByRole('menuitem', { name: 'Copy link' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect.element(page.getByRole('menuitem', { name: 'Copy link' })).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: copy');
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
    await expect.element(triggerElement).toHaveFocus();
});

test('Escape closes it without picking anything', async () => {
    await Actions.run();

    await userEvent.click(page.getByRole('button', { name: 'Actions' }));
    await expect.element(page.getByRole('menu')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: nothing');
});

test('a choice: the chosen item is checked, picking another with the keyboard changes it and closes the menu', async () => {
    await Choice.run();

    const trigger = page.getByRole('button', { name: 'Group: milestone' });
    await userEvent.keyboard('{Tab}');
    await expect.element(trigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    const milestone = page.getByRole('menuitemradio', { name: 'Milestone' });
    await expect.element(milestone).toHaveAttribute('aria-checked', 'true');
    await expect.element(milestone).toHaveFocus();
    await expect.element(page.getByRole('menuitemradio', { name: /Label/ })).toHaveAttribute('aria-checked', 'false');

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Group: label' })).toBeVisible();
});
