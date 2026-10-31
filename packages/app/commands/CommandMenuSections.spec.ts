import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './CommandMenuSections.stories.jsx';

const { Selection } = composeStories(stories);

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
