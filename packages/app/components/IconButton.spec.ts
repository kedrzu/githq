import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './IconButton.stories.jsx';

const { Gallery, WithTooltip } = composeStories(stories);

test("each size is on the buttons' scale, the size on the button itself for the e2e sweep", async () => {
    await Gallery.run();

    const expected = [
        { size: 'sm', name: 'Collapse sidebar', width: 24, height: 24 },
        { size: 'md', name: 'Expand the diff', width: 32, height: 32 },
        { size: 'rail', name: 'Account: kedrzu', width: 38, height: 34 },
    ];
    for (const { size, name, width, height } of expected) {
        const button = page.getByRole('button', { name, exact: true }).element();
        const box = button.getBoundingClientRect();
        expect([box.width, box.height], size).toEqual([width, height]);
        expect(button.tagName, size).toBe('BUTTON');
        expect(button.getAttribute('data-button-size'), size).toBe(size);
    }
});

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
