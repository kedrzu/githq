import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ReviewConversation.stories.js';

const { Cards } = composeStories(stories);

/** The entry of the conversation that reads `text`. */
function entry(text: string) {
    return page.getByRole('listitem').filter({ hasText: text });
}

async function openMenu(text: string) {
    await userEvent.click(entry(text).getByRole('button', { name: 'Comment actions' }));
}

test('CR120: the description, every comment and every review are the pull request’s cards, each with its ⋯', async () => {
    await Cards.run();

    await expect.element(page.getByRole('button', { name: 'Description actions' })).toBeVisible();
    expect(page.getByRole('listitem').elements()).toHaveLength(3);
    for (const item of page.getByRole('listitem').all()) {
        await expect.element(item.getByRole('button', { name: 'Comment actions' })).toBeVisible();
    }

    await expect.element(entry('Two things').getByText('requested changes')).toBeVisible();
    await expect.element(entry('Two things').getByRole('button', { name: /^2.threads.in.files$/u })).toBeVisible();
});

test('at 340 px nothing runs wider than the column, a very long login cut short, every ⋯ in view', async () => {
    await Cards.run();

    const scroller = page.getByRole('region', { name: 'Conversation' }).element().querySelector('[tabindex="0"]');
    expect(scroller).not.toBeNull();
    expect(scroller!.scrollWidth).toBeLessThanOrEqual(scroller!.clientWidth);
    const right = scroller!.getBoundingClientRect().right;
    for (const more of page.getByRole('button', { name: /actions$/u }).elements()) {
        expect(more.getBoundingClientRect().right).toBeLessThanOrEqual(right);
    }
});

test('Quote reply puts the comment, quoted, into the composer here, the cursor in it', async () => {
    await Cards.run();

    await openMenu('Same on mobile.');
    await userEvent.click(page.getByRole('menuitem', { name: 'Quote reply' }));

    const composer = page.getByRole('textbox', { name: 'Comment', exact: true });
    await expect.element(composer).toHaveValue('> Same on mobile.\n\n');
    await expect.element(composer).toHaveFocus();
});

test('the user’s own comment is edited in place and deleted once confirmed, as on the pull request’s thread', async () => {
    const onEdit = vi.fn();
    await Cards.run({ args: { ...Cards.args, onEdit } });

    await openMenu('Thanks, looks right.');
    await userEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    const editor = page.getByRole('textbox', { name: 'Edit comment' });
    await expect.element(editor).toHaveFocus();
    await userEvent.type(editor, ' Merging.');
    await userEvent.click(page.getByRole('button', { name: 'Update comment' }));
    expect(onEdit).toHaveBeenCalledWith({
        kind: 'editComment',
        commentId: 'C_MINE',
        body: 'Thanks, looks right. Merging.',
    });

    await openMenu('Thanks, looks right.');
    await userEvent.click(page.getByRole('menuitem', { name: 'Delete…' }));
    await userEvent.click(page.getByRole('button', { name: 'Delete comment' }));
    expect(onEdit).toHaveBeenLastCalledWith({ kind: 'deleteComment', commentId: 'C_MINE' });

    await openMenu('Same on mobile.');
    expect(
        page
            .getByRole('menuitem')
            .elements()
            .map(item => item.textContent.trim()),
    ).toEqual(['Quote reply', 'Copy link']);
});
