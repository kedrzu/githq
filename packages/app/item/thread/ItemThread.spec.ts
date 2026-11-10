import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { shallowReactive } from 'vue';

import type { ItemComment } from '@/store/ItemDetailTypes.js';
import { D1_ISSUE_DETAIL } from '@/testing/sampleItemDetails.js';

import * as stories from './ItemThread.stories.js';

const { IssueInPanel, PullRequestInPanel, NotSent, NotSentReadOnly } = composeStories(stories);

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

test('the comments the fold reveals take the focus at the first of them, so the keyboard keeps its place', async () => {
    const [newest] = D1_ISSUE_DETAIL.comments.nodes;
    const older: ItemComment[] = [
        { ...newest!, id: 'C_OLDER_1', bodyHtml: '<p>The first comment on the issue.</p>' },
        { ...newest!, id: 'C_OLDER_2', bodyHtml: '<p>The second comment on the issue.</p>' },
    ];
    // GitHub's answer: the detail with every comment, as the store puts it in.
    const loadAll = vi.fn(() => {
        const { comments } = D1_ISSUE_DETAIL;
        args.detail = { ...D1_ISSUE_DETAIL, comments: { ...comments, nodes: [...older, ...comments.nodes] } };
        return Promise.resolve();
    });
    const args = shallowReactive({ ...IssueInPanel.args, detail: D1_ISSUE_DETAIL, loadAll });
    await IssueInPanel.run({ args });

    page.getByRole('button', { name: /^Show 2 earlier comments/ })
        .element()
        .focus();
    await userEvent.keyboard('{Enter}');

    await expect.element(page.getByRole('button', { name: /earlier/ })).not.toBeInTheDocument();
    await expect
        .element(page.getByRole('listitem').filter({ hasText: 'The first comment on the issue.' }))
        .toHaveFocus();
});

test('with every comment read there is nothing to fold', async () => {
    await PullRequestInPanel.run();

    await expect.element(page.getByText('Good catch, adding a cross-repo fixture')).toBeInTheDocument();
    expect(page.getByRole('button', { name: /earlier/ }).query()).toBeNull();
});

test('a comment GitHub did not take says why, after those read, and offers Discard and Retry', async () => {
    const onRetry = vi.fn();
    const onDiscard = vi.fn();
    await NotSent.run({ args: { ...NotSent.args, onRetry, onDiscard } });

    const alerts = page.getByRole('alert');
    await expect.element(alerts.first()).toHaveTextContent("Not sent: GitHub can't be reached.");
    await expect.element(alerts.last()).toHaveTextContent('Not sent: GitHub refused it: Commenting is disabled.');
    await expect.element(page.getByText('Not sent', { exact: true }).first()).toBeVisible();

    await userEvent.click(page.getByRole('button', { name: 'Retry' }).first());
    expect(onRetry).toHaveBeenCalledWith(1);
    await userEvent.click(page.getByRole('button', { name: 'Discard' }).last());
    expect(onDiscard).toHaveBeenCalledWith(2);
});

test('where the user may no longer comment, a comment not sent stays readable with Discard, without Retry', async () => {
    await NotSentReadOnly.run();

    await expect.element(page.getByText('The cross-repository case is fixed in 3f2a9b1')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Discard' })).toBeVisible();
    expect(page.getByRole('button', { name: 'Retry' }).query()).toBeNull();
});
