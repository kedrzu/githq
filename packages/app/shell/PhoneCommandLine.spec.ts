import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import * as stories from './PhoneCommandLine.stories.js';

const { ListSelecting } = composeStories(stories);

test('mobile D28: while the list is selecting several, the chip says how many in place of the part', async () => {
    await ListSelecting.run();

    const line = page.getByRole('button', { name: /Do or find/u });
    await expect.element(line).toHaveTextContent(/^3 selected\s*Do or find…$/u);
});
