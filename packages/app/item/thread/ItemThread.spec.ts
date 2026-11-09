import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ItemThread.stories.js';

const { IssueInPanel, PullRequestInPanel } = composeStories(stories);

test('comments older than those read are folded before them; the fold reads them and is busy until they are in', async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    const loadAll = vi.fn(() => promise);
    await IssueInPanel.run({ args: { ...IssueInPanel.args, loadAll } });

    const fold = page.getByRole('button', { name: /^Show 2 earlier comments/ });
    await userEvent.click(fold);
    expect(loadAll).toHaveBeenCalledTimes(1);
    await expect.element(fold).toHaveAttribute('aria-busy', 'true');

    resolve();
    await expect.element(fold).not.toHaveAttribute('aria-busy');
});

test('with every comment read there is nothing to fold', async () => {
    await PullRequestInPanel.run();

    await expect.element(page.getByText('Good catch, adding a cross-repo fixture')).toBeInTheDocument();
    expect(page.getByRole('button', { name: /earlier/ }).query()).toBeNull();
});
