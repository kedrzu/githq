import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './PrivacyView.stories.js';

const { NotSharing } = composeStories(stories);

test('the switch shows whether statistics are shared and turns them back on; the link goes to what is counted', async () => {
    const onUpdate = vi.fn();
    await NotSharing.run({ args: { ...NotSharing.args, 'onUpdate:modelValue': onUpdate } });

    const toggle = page.getByRole('switch', { name: 'Share usage statistics' });
    await expect.element(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    expect(onUpdate).toHaveBeenLastCalledWith(true);

    await expect
        .element(page.getByRole('link', { name: 'What githq counts' }))
        .toHaveAttribute('href', '/docs/how-it-works/privacy-and-permissions#usage-statistics');
});
