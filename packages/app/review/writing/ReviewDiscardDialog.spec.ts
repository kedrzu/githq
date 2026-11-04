import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ReviewDiscardDialog.stories.js';

const { Several } = composeStories(stories);

test('focus starts on Cancel; ⌘↵ and the red button delete', async () => {
    const onDiscard = vi.fn();
    await Several.run({ args: { ...Several.args, onDiscard } });

    await expect.element(page.getByRole('button', { name: 'Cancel' })).toHaveFocus();

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    expect(onDiscard).toHaveBeenCalledOnce();
    await userEvent.click(page.getByRole('button', { name: 'Discard 3 comments' }));
    expect(onDiscard).toHaveBeenCalledTimes(2);
});
