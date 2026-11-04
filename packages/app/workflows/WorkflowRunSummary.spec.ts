import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import * as stories from './WorkflowRunSummary.stories.js';

const { DaysAgo, RerunGoing } = composeStories(stories);

const summary = page.getByTestId('workflow-run-summary');

test('W4j: while a re-run goes it says when the re-run started, not when the run was created', async () => {
    await RerunGoing.run();

    await expect.element(summary).toHaveTextContent('started 1m ago · Deploy is still broken');
});

test('a finished run says when it was created', async () => {
    await DaysAgo.run();

    await expect.element(summary).toHaveTextContent('3 days ago');
});
