import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './CommandMenuSections.stories.jsx';

const { PhoneSelection, Selection } = composeStories(stories);

test('a submenu shows what is set — checked, half-checked — and typing over it filters; picking runs the option and closes the menu', async () => {
    await Selection.run();

    await userEvent.keyboard('{Tab}{Enter}');
    // The chevron says there is more: no "…" in the menu.
    const assign = page.getByRole('menuitem', { name: 'Assign to' });
    await expect.element(assign).toHaveFocus();
    await expect.element(assign).toHaveAttribute('aria-keyshortcuts', 'A');
    await userEvent.keyboard('{ArrowRight}');

    await expect
        .element(page.getByRole('menuitemcheckbox', { name: /^kedrzu/ }))
        .toHaveAttribute('aria-checked', 'true');
    await expect
        .element(page.getByRole('menuitemcheckbox', { name: /^pnowak/ }))
        .toHaveAttribute('aria-checked', 'mixed');
    await expect.element(page.getByText('Only people who can be assigned in both repositories.')).toBeVisible();

    await userEvent.keyboard('wro');
    await expect.element(page.getByRole('textbox', { name: 'Filter: Assign to…' })).toHaveValue('wro');
    await expect.element(page.getByRole('menuitemcheckbox')).toHaveTextContent('bwrona');

    await userEvent.click(page.getByRole('menuitemcheckbox', { name: 'bwrona' }));
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: bwrona');
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
});

test('an action without a second step runs when picked; empty groups leave no line', async () => {
    await Selection.run();

    await userEvent.click(page.getByRole('button', { name: '3 issues' }));
    expect(document.querySelectorAll('[role="separator"]')).toHaveLength(2);
    await userEvent.click(page.getByRole('menuitem', { name: 'Copy links' }));
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: links');
});

test('on a phone a submenu drills in place: what is set is checked, typing filters, picking runs it and closes', async () => {
    await PhoneSelection.run();

    const sheet = page.getByRole('dialog', { name: '3 issues' });
    await userEvent.click(sheet.getByRole('menuitem', { name: 'Assign to' }));
    const people = sheet.getByRole('menu', { name: 'Assign to' });
    await expect
        .element(people.getByRole('menuitemcheckbox', { name: /^kedrzu/ }))
        .toHaveAttribute('aria-checked', 'true');
    await expect
        .element(people.getByRole('menuitemcheckbox', { name: /^pnowak/ }))
        .toHaveAttribute('aria-checked', 'mixed');

    await userEvent.type(people.getByRole('textbox', { name: 'Filter: Assign to…' }), 'wro');
    await userEvent.click(people.getByRole('menuitemcheckbox', { name: 'bwrona' }));
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: bwrona');
    await expect.element(sheet).not.toBeInTheDocument();
});

test("on a phone Home and End in a submenu's filter move its caret, not to the entries; ↓ goes to the entries", async () => {
    await PhoneSelection.run();

    const sheet = page.getByRole('dialog', { name: '3 issues' });
    await userEvent.click(sheet.getByRole('menuitem', { name: 'Assign to' }));
    const people = sheet.getByRole('menu', { name: 'Assign to' });
    const filter = people.getByRole('textbox', { name: 'Filter: Assign to…' });
    await userEvent.type(filter, 'wro');

    await userEvent.keyboard('{Home}');
    await expect.element(filter).toHaveFocus();
    expect(filter.element()).toHaveProperty('selectionStart', 0);
    await userEvent.keyboard('{End}');
    await expect.element(filter).toHaveFocus();
    expect(filter.element()).toHaveProperty('selectionStart', 3);

    await userEvent.keyboard('{ArrowDown}');
    await expect.element(people.getByRole('menuitemcheckbox', { name: 'bwrona' })).toHaveFocus();
});
