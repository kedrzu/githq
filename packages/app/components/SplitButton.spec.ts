import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './SplitButton.stories.jsx';

const { CloseIssue } = composeStories(stories);

test('the button does the usual action; the chevron is a target of its own and opens the other ways', async () => {
    await CloseIssue.run();

    const done = page.getByTestId('done');
    const chevron = page.getByRole('button', { name: 'More ways to close' });
    await userEvent.click(chevron);
    await userEvent.click(page.getByRole('menuitem', { name: 'Close as not planned' }));
    await expect.element(done).toHaveTextContent('Closed as: not planned');

    await userEvent.click(page.getByRole('button', { name: 'Close issue' }));
    await expect.element(done).toHaveTextContent('Closed as: completed');
});
