import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ItemThreadComposer.stories.js';

const { Archived, ClosedIssue, ClosedPullRequest, CommentOnly, Locked, MergedPullRequest, OpenIssue, OpenPullRequest } =
    composeStories(stories);

const box = () => page.getByRole('textbox', { name: 'Comment' });
const commentButton = () => page.getByRole('button', { name: 'Comment', exact: true });

test('an open issue closes as completed from its button (⇧X) and as not planned from its menu', async () => {
    await OpenIssue.run();
    const { onEdit } = OpenIssue.args;

    const close = page.getByRole('button', { name: 'Close issue', exact: true });
    await expect.element(close).toHaveAttribute('aria-keyshortcuts', 'Shift+X');
    await userEvent.click(close);
    expect(onEdit).toHaveBeenLastCalledWith({ kind: 'close', reason: 'COMPLETED' });

    await userEvent.click(page.getByRole('button', { name: 'More ways to close' }));
    await userEvent.click(page.getByRole('menuitem', { name: 'Close as not planned' }));
    expect(onEdit).toHaveBeenLastCalledWith({ kind: 'close', reason: 'NOT_PLANNED' });
    expect(onEdit).toHaveBeenCalledTimes(2);
});

test('Comment is dimmed and does nothing while nothing is typed; ⌘↵ and the button post what is typed and empty the box', async () => {
    await OpenIssue.run();
    const { onEdit } = OpenIssue.args;

    await expect.element(commentButton()).toHaveAttribute('aria-disabled', 'true');
    // Playwright won't press a button announced as unavailable; a click still reaches it.
    commentButton()
        .element()
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onEdit).not.toHaveBeenCalled();

    await userEvent.click(box());
    await userEvent.keyboard('Looks good{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    expect(onEdit).toHaveBeenLastCalledWith({ kind: 'comment', body: 'Looks good', keptInThread: true });
    await expect.element(box()).toHaveValue('');

    await userEvent.fill(box(), '  Second  ');
    await expect.element(commentButton()).not.toHaveAttribute('aria-disabled');
    await userEvent.click(commentButton());
    expect(onEdit).toHaveBeenLastCalledWith({ kind: 'comment', body: 'Second', keptInThread: true });
    await expect.element(box()).toHaveValue('');
});

test('an open pull request closes from its button; a closed one, issue or pull request, reopens', async () => {
    await OpenPullRequest.run();
    await userEvent.click(page.getByRole('button', { name: 'Close pull request', exact: true }));
    expect(OpenPullRequest.args.onEdit).toHaveBeenLastCalledWith({ kind: 'close', reason: 'COMPLETED' });

    await ClosedIssue.run();
    await userEvent.click(page.getByRole('button', { name: 'Reopen issue', exact: true }));
    expect(ClosedIssue.args.onEdit).toHaveBeenLastCalledWith({ kind: 'reopen' });

    await ClosedPullRequest.run();
    await expect.element(page.getByRole('button', { name: 'Reopen pull request', exact: true })).toBeVisible();
});

test('K1b: no close or reopen where the user may not, nor on a merged pull request — Comment stays', async () => {
    for (const story of [CommentOnly, MergedPullRequest]) {
        await story.run();
        await expect.element(commentButton()).toBeVisible();
        expect(page.getByRole('button', { name: /^(Close|Reopen)/ }).query()).toBeNull();
        expect(page.getByRole('button', { name: 'More ways to close' }).query()).toBeNull();
    }
});

test('locked or archived: one line says why instead of the editor, nothing to type into or press', async () => {
    await Locked.run();
    await expect
        .element(page.getByText('This conversation is locked to collaborators, so you can read it but not comment.'))
        .toBeVisible();
    expect(box().query()).toBeNull();
    expect(page.getByRole('button').query()).toBeNull();

    await Archived.run();
    await expect.element(page.getByText('skyline-labs/portal is archived, so it takes no new comments.')).toBeVisible();
    expect(box().query()).toBeNull();
});
