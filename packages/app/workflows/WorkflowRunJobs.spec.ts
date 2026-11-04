import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import * as stories from './WorkflowRunJobs.stories.js';

const { OneMatch, Searching } = composeStories(stories);

test('W4b: what a screen reader hears of the matches counts them right, one or many', async () => {
    await OneMatch.run();
    await expect.element(page.getByTestId('workflow-job-matches')).toHaveTextContent(/^1 match$/u);
    await expect.element(page.getByTestId('workflow-step-matches')).toHaveTextContent(/^1 match$/u);

    await Searching.run();
    await expect.element(page.getByTestId('workflow-job-matches')).toHaveTextContent(/^12 matches$/u);
});
