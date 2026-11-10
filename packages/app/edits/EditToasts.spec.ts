import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './EditToasts.stories.js';

const { CommentRefusedBoxInUse, CommentRefusedRestored } = composeStories(stories);

const toast = () => page.getByRole('listitem');
const box = () => page.getByRole('textbox', { name: 'Comment box' });
const restore = () => toast().getByRole('button', { name: 'Restore comment' });

test('a comment refused while something new is in its box: "Restore comment" puts it back after what is typed', async () => {
    await CommentRefusedBoxInUse.run();
    await expect.element(box()).toHaveValue('A new thought');

    await userEvent.click(restore());

    await expect.element(box()).toHaveValue('A new thought\n\nShipping this behind the flag first.');
    await expect.element(restore()).not.toBeInTheDocument();
});

test('a comment refused that went back into its box is not offered again', async () => {
    await CommentRefusedRestored.run();

    await expect.element(toast()).toBeVisible();
    await expect.element(restore()).not.toBeInTheDocument();
});
