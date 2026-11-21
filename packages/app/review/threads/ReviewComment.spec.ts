import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ReviewComment.stories.js';

const { Comment, EditSending, WithMenu } = composeStories(stories);

/** `$color-fg`, `$color-fg-dim`. */
const FG = 'rgb(240, 246, 252)';
const FG_DIM = 'rgb(139, 146, 155)';

/** What the ⋯ is drawn in, on the header row: its opacity says whether it is in sight. */
function getMoreOpacity() {
    const more = page.getByRole('button', { name: 'Comment actions' }).element().closest('p > span');
    return more ? getComputedStyle(more).opacity : null;
}

test('the ⋯ is out of sight until the comment is hovered or the focus is in it, and absent without actions', async () => {
    await WithMenu.run();
    // The pointer may still be where the test before left it, over the comment.
    await userEvent.unhover(page.getByText('sofiab', { exact: true }));
    await expect.poll(getMoreOpacity).toBe('0');

    await userEvent.hover(page.getByText('sofiab', { exact: true }));
    await expect.poll(getMoreOpacity).toBe('1');

    await userEvent.unhover(page.getByText('sofiab', { exact: true }));
    await expect.poll(getMoreOpacity).toBe('0');
    await userEvent.tab();
    await userEvent.tab();
    await expect.element(page.getByRole('button', { name: 'Comment actions' })).toHaveFocus();
    await expect.poll(getMoreOpacity).toBe('1');

    await Comment.run();
    expect(page.getByRole('button', { name: 'Comment actions' }).query()).toBeNull();
});

test('a right click on the comment opens its menu, Edit putting the editor in place under the header row', async () => {
    await WithMenu.run();

    await userEvent.click(page.getByText('sofiab', { exact: true }), { button: 'right' });
    await userEvent.click(page.getByRole('menuitem', { name: 'Edit' }));

    await expect.element(page.getByRole('textbox', { name: 'Edit comment' })).toBeVisible();
    await expect.element(page.getByText('sofiab', { exact: true })).toBeVisible();
});

test('what it says is in the card text colour; an edit on its way dimmed, "Sending…", with no ⋯', async () => {
    await Comment.run();
    const text = page.getByText(/^What happens when the same workout/u).element();
    expect(getComputedStyle(text).color).toBe(FG);

    await EditSending.run();
    const sending = page.getByText('What happens when the same workout is edited twice offline?').element();
    expect(getComputedStyle(sending).color).toBe(FG_DIM);
    await expect.element(page.getByText('Sending…')).toBeVisible();
    expect(page.getByRole('button', { name: 'Comment actions' }).query()).toBeNull();
});

test("what it says sits under the header row at full width, from the avatar's left edge, not indented past it", async () => {
    await Comment.run();
    const avatar = page.getByText('sofiab', { exact: true }).element().closest('p')?.firstElementChild;
    const author = page.getByText('sofiab', { exact: true }).element().getBoundingClientRect();
    const text = page
        .getByText(/^What happens when the same workout/u)
        .element()
        .getBoundingClientRect();
    expect(avatar).toBeInstanceOf(HTMLElement);

    expect(text.left).toBe(avatar!.getBoundingClientRect().left);
    expect(text.top).toBeGreaterThanOrEqual(author.bottom);
});
