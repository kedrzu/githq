import { composeStories } from '@storybook/vue3-vite';
import { expect, test } from 'vitest';
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
