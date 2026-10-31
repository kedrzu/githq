import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './Toast.stories.jsx';

const { EditRejected } = composeStories(stories);

test('Escape dismisses it, and the screen behind never sees that Escape', async () => {
    await EditRejected.run();
    const toast = page.getByRole('listitem');
    await expect.element(toast).toHaveTextContent('Label “regression” wasn’t added');

    await userEvent.keyboard('{Escape}');

    await expect.element(toast).not.toBeInTheDocument();
    await expect.element(page.getByTestId('dismissed')).toHaveTextContent('Dismissed: 1');
    await expect.element(page.getByTestId('escapes')).toHaveTextContent('Escapes seen behind: 0');
});

test('Escape typed into a field is the field’s: the toast stays', async () => {
    await EditRejected.run();

    await userEvent.click(page.getByRole('textbox', { name: 'Note' }));
    await userEvent.keyboard('{Escape}');

    await expect.element(page.getByRole('listitem')).toHaveTextContent('Label “regression” wasn’t added');
    await expect.element(page.getByTestId('dismissed')).toHaveTextContent('Dismissed: 0');
});

test('"Dismiss" dismisses it', async () => {
    await EditRejected.run();

    await userEvent.click(page.getByRole('button', { name: 'Dismiss' }).first());

    await expect.element(page.getByTestId('dismissed')).toHaveTextContent('Dismissed: 1');
});
