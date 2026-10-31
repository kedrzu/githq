import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ChoiceList.stories.jsx';

const { Gallery } = composeStories(stories);

test('the options are radios: a click chooses, ↓/↑ move and choose', async () => {
    await Gallery.run();

    const owners = page.getByRole('radiogroup', { name: 'Owners' });
    const all = owners.getByRole('radio', { name: /^All owners/ });
    const kedrzu = owners.getByRole('radio', { name: 'kedrzu 4 of 12 selected' });
    await expect.element(all).toBeChecked();

    await userEvent.click(all);
    await expect.element(all).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect.element(kedrzu).toHaveFocus();
    await expect.element(kedrzu).toBeChecked();
    await expect.element(all).not.toBeChecked();
    await expect.element(page.getByTestId('owner')).toHaveTextContent('Owner: kedrzu');

    await userEvent.keyboard('{ArrowUp}');
    await expect.element(page.getByTestId('owner')).toHaveTextContent('Owner: all');

    await userEvent.click(owners.getByRole('radio', { name: /^acme-health/ }));
    await expect.element(page.getByTestId('owner')).toHaveTextContent('Owner: acme-health');
});
