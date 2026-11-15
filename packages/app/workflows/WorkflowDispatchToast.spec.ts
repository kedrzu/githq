import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { matchText } from '@/testing/matchText.js';

import * as stories from './WorkflowDispatchToast.stories.js';

const { Started, Refused } = composeStories(stories);

/** The toast's words, with plain spaces: the translations keep short words with the next one. */
const toastText = () => document.querySelector('[role="region"]')?.textContent?.replaceAll(/\s+/gu, ' ');

test('W39: the run started is named with its ref and number, and Open (⌥O) goes to its page', async () => {
    await Started.run();

    await expect.element(page.getByText(matchText('Deploy started on main · #4826'))).toBeVisible();
    expect(toastText()).toContain('environment production · version 2.14.0 · dry_run off. Queued on GitHub.');

    await userEvent.keyboard('{Alt>}o{/Alt}');

    await expect.element(page.getByText('At /fitloop/webapp/actions/runs/904826')).toBeVisible();
});

test('a refusal says GitHub’s words and that nothing started', async () => {
    await Refused.run();

    await expect.element(page.getByText(matchText("Deploy wasn't run on main"))).toBeVisible();
    expect(toastText()).toContain(
        "GitHub refused it: Workflow does not have 'workflow_dispatch' trigger. Nothing was started.",
    );
});
