import { composeStories } from '@storybook/vue3-vite';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './DiffCommentButton.stories.js';

const { Default } = composeStories(stories);

test('hovered, its tooltip names the line and the key C; a click is told as the gutter click that opens a box', async () => {
    await Default.run();
    const button = page.getByRole('button', { name: 'Comment on line 51' });

    await userEvent.hover(button);
    // The tooltip opens and describes it: the line and the key.
    await expect.element(button).toHaveAccessibleDescription(/^Comment on\sline 51C$/u);

    await userEvent.click(button);
    expect(Default.args.onGutter).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'click' }));
});

test('a click beside the square, still in the gutter around it, is told as a gutter click too', async () => {
    const onGutter = vi.fn();
    await Default.run({ args: { ...Default.args, onGutter } });
    const button = page.getByRole('button', { name: 'Comment on line 51' });

    // 2 px left of the 16 px square: outside what it shows, inside the room it takes clicks in.
    await userEvent.click(button, { position: { x: -2, y: 8 } });
    expect(onGutter).toHaveBeenCalledWith(expect.objectContaining({ type: 'click' }));
});
