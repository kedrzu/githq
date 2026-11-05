import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { formatCommandKey } from '@/commands/formatCommandKey.js';

import * as stories from './CodeReviewView.stories.js';

const { DraftReview } = composeStories(stories);

test('the chosen way is the checked card of a group named Comments, the keys as this platform writes them', async () => {
    await DraftReview.run();

    const group = page.getByRole('radiogroup', { name: 'Comments' });
    await expect.element(group.getByRole('radio', { name: 'Add it to a draft review' })).toBeChecked();
    await expect.element(group.getByRole('radio', { name: 'Send it at once' })).not.toBeChecked();
    await expect
        .element(page.getByText(`What ${formatCommandKey('Mod+Enter')} does with a comment`))
        .toHaveTextContent(`${formatCommandKey('Mod+Shift+Enter')} always does the other.`);
});
