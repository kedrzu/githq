import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './Menu.stories.jsx';

const { Actions, Choice, PhoneChoice, PhoneSubmenu, Submenu } = composeStories(stories);

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

test('a submenu opens with → and picks from it; ← goes back to its entry', async () => {
    await Submenu.run();

    await userEvent.keyboard('{Tab}{Enter}');
    await expect.element(page.getByRole('menuitem', { name: /^Copy reference/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    const close = page.getByRole('menuitem', { name: 'Close issue' });
    await expect.element(close).toHaveFocus();
    await expect.element(close).toHaveAttribute('aria-keyshortcuts', 'Shift+X');

    await userEvent.keyboard('{ArrowRight}');
    await expect.element(page.getByRole('menuitem', { name: 'Close as completed' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect.element(close).toHaveFocus();

    await userEvent.keyboard('{ArrowRight}{ArrowDown}{Enter}');
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: notPlanned');
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
});

test('on a phone it opens at the bottom: an entry runs and closes it', async () => {
    await PhoneSubmenu.run();

    const sheet = page.getByRole('dialog', { name: 'Item actions' });
    await expect.element(sheet).toHaveAccessibleDescription('fitloop/webapp#1187');
    expect(Math.round(sheet.element().getBoundingClientRect().bottom)).toBe(window.innerHeight);
    const menu = sheet.getByRole('menu', { name: 'Item actions' });
    await expect.element(menu.getByRole('menuitem', { name: 'Open on GitHub' })).toHaveFocus();
    // No keys on a phone (mobile D52).
    await expect.element(menu.getByText('O', { exact: true })).not.toBeInTheDocument();

    await expect
        .element(menu.getByRole('menuitem', { name: 'Transfer issue' }))
        .toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(menu.getByRole('menuitem', { name: /^Copy reference/ }));
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: copy');
    await expect.element(sheet).not.toBeInTheDocument();
});

test('on a phone a submenu drills in place: ← and Escape go back to its entry, Escape then closes', async () => {
    await PhoneSubmenu.run();

    const sheet = page.getByRole('dialog', { name: 'Item actions' });
    const close = sheet.getByRole('menuitem', { name: 'Close issue' });
    await userEvent.click(close);
    const submenu = sheet.getByRole('menu', { name: 'Close issue' });
    await expect.element(submenu.getByRole('menuitem', { name: 'Close as completed' })).toHaveFocus();
    await expect.element(sheet.getByRole('menuitem', { name: 'Open on GitHub' })).not.toBeInTheDocument();

    await userEvent.click(sheet.getByRole('button', { name: 'Back' }));
    await expect.element(close).toHaveFocus();

    await userEvent.click(close);
    await userEvent.keyboard('{Escape}');
    await expect.element(close).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await expect.element(sheet).not.toBeInTheDocument();
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: nothing');

    await userEvent.click(page.getByRole('button', { name: 'Issue' }));
    await userEvent.click(close);
    await userEvent.click(sheet.getByRole('menuitem', { name: /^Close as not planned/ }));
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: notPlanned');
    await expect.element(sheet).not.toBeInTheDocument();
});

test('on a phone a choice is checked; picking another changes it and closes the menu', async () => {
    await PhoneChoice.run();

    const sheet = page.getByRole('dialog', { name: 'Group by' });
    await expect
        .element(sheet.getByRole('menuitemradio', { name: 'Milestone' }))
        .toHaveAttribute('aria-checked', 'true');
    await userEvent.click(sheet.getByRole('menuitemradio', { name: /^Label/ }));

    await expect.element(sheet).not.toBeInTheDocument();
    await expect.element(page.getByTestId('grouping')).toHaveTextContent('Grouping: label');
});
