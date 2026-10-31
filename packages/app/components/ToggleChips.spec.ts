import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ToggleChips.stories.jsx';

const { Properties } = composeStories(stories);

test("each chip toggles on its own, and what is on stays in the options' order", async () => {
    await Properties.run();

    const priority = page.getByRole('button', { name: 'Priority' });
    await expect.element(priority).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(priority);
    await expect.element(priority).toHaveAttribute('aria-pressed', 'true');
    await expect.element(page.getByTestId('shown')).toHaveTextContent('repo priority labels');

    await userEvent.click(page.getByRole('button', { name: 'Repo' }));
    await expect.element(page.getByTestId('shown')).toHaveTextContent(/^priority labels$/);
});
