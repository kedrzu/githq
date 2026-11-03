import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './SegmentedTabs.stories.jsx';

const { Gallery } = composeStories(stories);

test('Tab reaches the chosen option, ←/→ move between options, Space chooses; choosing it again keeps it', async () => {
    await Gallery.run();

    const filters = page.getByRole('group', { name: 'Filters' });
    const all = filters.getByRole('button', { name: 'All' });
    const needsMe = filters.getByRole('button', { name: 'Needs me' });
    await expect.element(all).toHaveAttribute('aria-pressed', 'true');

    await userEvent.keyboard('{Tab}');
    await expect.element(all).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect.element(needsMe).toHaveFocus();
    await userEvent.keyboard(' ');
    await expect.element(needsMe).toHaveAttribute('aria-pressed', 'true');
    await expect.element(all).toHaveAttribute('aria-pressed', 'false');
    await expect.element(page.getByTestId('filter')).toHaveTextContent('Filter: needsMe');

    // Pressing the chosen one doesn't clear the choice.
    await userEvent.click(needsMe);
    await expect.element(page.getByTestId('filter')).toHaveTextContent('Filter: needsMe');
});

test('vertical: one Tab stop, ↓/↑ move between the rows and ←/→ do not, Space chooses; each row shows its icon and key, read out as its shortcut', async () => {
    await Gallery.run();

    const sections = page.getByRole('group', { name: 'Sections' });
    const issues = sections.getByRole('button', { name: 'Issues 5' });
    const pullRequests = sections.getByRole('button', { name: 'Pull requests 1' });
    await expect.element(issues).toHaveAttribute('aria-pressed', 'true');
    await expect.element(issues).toHaveAttribute('aria-keyshortcuts', '1');
    await expect.element(issues.getByText('1', { exact: true })).toBeVisible();
    expect(issues.element().querySelector('svg')).not.toBeNull();

    await userEvent.click(issues);
    await userEvent.keyboard('{ArrowRight}');
    await expect.element(issues).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect.element(pullRequests).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    await expect.element(issues).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard(' ');
    await expect.element(pullRequests).toHaveAttribute('aria-pressed', 'true');
    await expect.element(page.getByTestId('section')).toHaveTextContent('Section: pullRequests');

    // Past the group in one Tab: the rows aren't stops of their own.
    await userEvent.keyboard('{Tab}');
    expect(sections.element().contains(document.activeElement)).toBe(false);
});
