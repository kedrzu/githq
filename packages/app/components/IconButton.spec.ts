import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './IconButton.stories.jsx';

const { WithTooltip } = composeStories(stories);

test('its label names it, and its tooltip, with the label and key, opens on keyboard focus too', async () => {
    await WithTooltip.run();

    const collapse = page.getByRole('button', { name: 'Collapse sidebar' });
    await userEvent.keyboard('{Tab}');
    await expect.element(collapse).toHaveFocus();
    // The tooltip opens and describes it: the label and the key.
    await expect.element(collapse).toHaveAccessibleDescription('Collapse sidebar[');

    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByTestId('clicks')).toHaveTextContent('Clicks: 1');
});
