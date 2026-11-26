import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ReviewComment.stories.js';

const { Comment, Current, EditSending, UnderReadingCursor, WithMenu } = composeStories(stories);

/** `$color-fg`, `$color-fg-dim`. */
const FG = 'rgb(240, 246, 252)';
const FG_DIM = 'rgb(139, 146, 155)';
/** `$color-current-tint`: the accent at 6.5 %, which the browser keeps as 17/255. */
const CURRENT_TINT = 'rgba(123, 135, 247, 0.067)';

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

test('what it says, rendered or as typed, takes the Reading size and font, its code the Code font; the header row keeps the interface ones', async () => {
    await Comment.run({
        args: {
            ...Comment.args,
            html: '<p>What happens when the same workout is saved by <code>saveWorkout</code>?</p>',
        },
    });
    const author = page.getByText('sofiab', { exact: true }).element();
    const interfaceStyle = {
        fontSize: getComputedStyle(author).fontSize,
        fontFamily: getComputedStyle(author).fontFamily,
    };
    const root = document.documentElement.style;
    root.setProperty('--font-size-reading', '19px');
    root.setProperty('--line-height-reading', '1.75');
    root.setProperty('--font-family-reading', 'Georgia, serif');
    root.setProperty('--font-family-code', 'Courier, monospace');
    try {
        const text = getComputedStyle(page.getByText(/^What happens when the same workout/u).element());
        expect([text.fontSize, text.lineHeight, text.fontFamily]).toEqual(['19px', '33.25px', 'Georgia, serif']);
        expect(getComputedStyle(page.getByText('saveWorkout').element()).fontFamily).toBe('Courier, monospace');
        expect({
            fontSize: getComputedStyle(author).fontSize,
            fontFamily: getComputedStyle(author).fontFamily,
        }).toEqual(interfaceStyle);

        await EditSending.run();
        const typed = getComputedStyle(
            page.getByText('What happens when the same workout is edited twice offline?').element(),
        );
        expect([typed.fontSize, typed.lineHeight, typed.fontFamily]).toEqual(['19px', '33.25px', 'Georgia, serif']);
    } finally {
        root.removeProperty('--font-size-reading');
        root.removeProperty('--line-height-reading');
        root.removeProperty('--font-family-reading');
        root.removeProperty('--font-family-code');
    }
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

test("code review's current comment is tinted over its whole box and aria-current; any other is not", async () => {
    await Current.run();
    const box = document.querySelector('[data-cursor-comment]');
    expect(box).toBeInstanceOf(HTMLElement);
    expect(box!.getAttribute('data-cursor-comment')).toBe(Current.args.commentId);
    expect(box!.contains(page.getByText('sofiab', { exact: true }).element())).toBe(true);
    expect(getComputedStyle(box!).backgroundColor).toBe(CURRENT_TINT);
    expect(box!.getAttribute('aria-current')).toBe('true');

    await WithMenu.run();
    const other = document.querySelector('[data-cursor-comment]')!;
    expect(getComputedStyle(other).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(other.hasAttribute('aria-current')).toBe(false);
});

test("a comment's menu shows W and Q when it is code review's current one or under a page's reading cursor, else none", async () => {
    for (const story of [Current, UnderReadingCursor]) {
        await story.run();
        await userEvent.click(page.getByText('sofiab', { exact: true }), { button: 'right' });
        await expect.element(page.getByRole('menuitem', { name: /^Edit/u })).toHaveAttribute('aria-keyshortcuts', 'W');
        await expect
            .element(page.getByRole('menuitem', { name: /^Quote reply/u }))
            .toHaveAttribute('aria-keyshortcuts', 'Q');
        await userEvent.keyboard('{Escape}');
    }

    // In code review off the cursor, as everywhere with no reading cursor (code review's conversation): no keys.
    await WithMenu.run();
    await userEvent.click(page.getByText('sofiab', { exact: true }), { button: 'right' });
    await expect.element(page.getByRole('menuitem', { name: 'Edit' })).not.toHaveAttribute('aria-keyshortcuts');
});
