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
