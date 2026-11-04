import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './CloseToasts.stories.js';

const { One, Several } = composeStories(stories);

const toast = () => page.getByRole('listitem');

test('Undo names what closed and takes it back', async () => {
    await One.run();
    await expect.element(toast()).toHaveTextContent('Closed fitloop/api#477');

    await userEvent.click(toast().getByRole('button', { name: 'Undo' }));

    await expect.element(toast()).not.toBeInTheDocument();
});

test('⌘Z takes it back while it shows', async () => {
    await One.run();
    await expect.element(toast()).toBeVisible();

    await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}');

    await expect.element(toast()).not.toBeInTheDocument();
});

test('several closed together are counted, with one Undo', async () => {
    await Several.run();

    await expect.element(toast()).toHaveTextContent('Closed 3 items');
    await expect.element(toast().getByRole('button', { name: 'Undo' })).toBeVisible();
});
