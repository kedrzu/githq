import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './EditToasts.stories.js';

const { CommentRefusedBoxInUse, CommentRefusedRestored, PhoneLabelPartlyFailed } = composeStories(stories);

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

test('mobile D28, K2: a label added to three refused for one names it and why; "Select the failed item" asks the list for it alone', async () => {
    await PhoneLabelPartlyFailed.run();

    await expect.element(toast()).toHaveTextContent('“docs” added to 2 of 3 items');
    await expect.element(toast()).toHaveTextContent('#1204');
    await userEvent.click(toast().getByRole('button', { name: 'Select the failed item' }));

    await expect.element(page.getByRole('status', { name: 'Asked to select' })).toHaveTextContent(/^I_1204$/);
});
