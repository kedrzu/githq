import { composeStories } from '@storybook/vue3';
import { expect, onTestFinished, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './KeyHelp.stories.jsx';

const { Closed, ListBesideItem, OnItemPage } = composeStories(stories);

test('? lists the keys the registry runs, by section; Escape closes it and leaves the item open', async () => {
    await Closed.run();

    await userEvent.keyboard('?');
    const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    const item = help.getByRole('region', { name: 'Opened item' });
    await expect.element(item.getByRole('term').filter({ hasText: 'Set status' })).toBeInTheDocument();
    await expect.element(item.getByRole('definition').filter({ hasText: 'Shift+X' })).toBeInTheDocument();
    await expect.element(help.getByRole('term').filter({ hasText: 'Keyboard shortcuts' })).toBeInTheDocument();
    // The item's own keys, handled by the item view itself, are listed too.
    for (const [title, key] of [
        ['Next item', 'J'],
        ['Previous item', 'K'],
        ['Close', 'Escape'],
    ] as const) {
        await expect.element(item.getByRole('definition').filter({ hasText: key }).first()).toBeInTheDocument();
        await expect.element(item.getByRole('term').filter({ hasText: title }).first()).toBeInTheDocument();
    }

    // While it is open, a key is not an action: S does not open the status picker under it.
    await userEvent.keyboard('s');
    await expect.element(page.getByRole('listbox', { name: 'Status' })).not.toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await expect.element(help).not.toBeInTheDocument();
    await expect.element(page.getByTestId('item')).toHaveTextContent('open');
});

test("with a list and an item on one key, O runs the list's and ? lists only the list's", async () => {
    await ListBesideItem.run();

    await userEvent.keyboard('o');
    await expect.element(page.getByTestId('ran')).toHaveTextContent('list');

    await userEvent.keyboard('?');
    const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect.element(help.getByRole('term').filter({ hasText: 'Open the row' })).toBeInTheDocument();
    await expect.element(help.getByRole('term').filter({ hasText: 'Open the item' })).not.toBeInTheDocument();
});

test("on the item's page the thread's keys come first, then the item's others and the app's, none listed twice", async () => {
    // A phone's item has no reading cursor: a window as wide as a computer's.
    await page.viewport(1280, 800);
    onTestFinished(() => page.viewport(414, 896));
    await OnItemPage.run();

    const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    const thread = help.getByRole('region', { name: 'The thread' });
    await expect.element(thread.getByRole('term').filter({ hasText: 'Previous and next comment' })).toBeInTheDocument();
    await expect.element(thread.getByRole('term').filter({ hasText: 'Edit your comment' })).toBeInTheDocument();
    const item = help.getByRole('region', { name: 'Opened item' });
    await expect.element(item.getByRole('term').filter({ hasText: 'Set status' }).first()).toBeInTheDocument();
    // `R` and `[` `]` are the thread's: the item's column leaves them out.
    await expect.element(item.getByRole('term').filter({ hasText: 'Next comment' })).not.toBeInTheDocument();
    await expect.element(item.getByRole('term').filter({ hasText: /^Comment$/u })).not.toBeInTheDocument();
    await expect.element(help.getByRole('region', { name: 'Anywhere' })).toBeInTheDocument();
});
