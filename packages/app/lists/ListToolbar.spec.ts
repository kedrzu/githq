import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ListToolbar.stories.js';

const { PlainTitle, TitleMenu } = composeStories(stories);

test('with a menu, the title is a button that opens it', async () => {
    await TitleMenu.run();

    const title = page
        .getByRole('heading', { name: 'Platform Q4' })
        .getByRole('button', { name: 'Actions of Platform Q4' });
    await userEvent.click(title);
    await expect.element(page.getByRole('menu')).toHaveTextContent('Platform Q4 · fitloop');
    await expect.element(page.getByRole('menuitem', { name: 'Open on GitHub' })).toBeVisible();
});

test('without a menu, the title is plain text', async () => {
    await PlainTitle.run();

    await expect.element(page.getByRole('heading', { name: 'Platform Q4' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: /Platform Q4/ })).not.toBeInTheDocument();
});
