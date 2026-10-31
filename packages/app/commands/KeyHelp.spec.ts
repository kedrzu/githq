import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './KeyHelp.stories.jsx';

const { Closed } = composeStories(stories);

test('? lists the keys the registry runs, by section; Escape closes it and leaves the item open', async () => {
    await Closed.run();

    await userEvent.keyboard('?');
    const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    const item = help.getByRole('region', { name: 'Opened item' });
    await expect.element(item.getByRole('term').filter({ hasText: 'Set status…' })).toBeInTheDocument();
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
