import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import * as stories from './CommentCard.stories.js';

const {
    Current,
    CurrentLinked,
    CurrentPending,
    Linked,
    Narrow,
    NarrowLongLogin,
    NotAStop,
    NotCurrent,
    WideReview,
    WidestReview,
    Within,
} = composeStories(stories);

/** `$color-current-edge`, `$color-current-header`, `$color-accent`, `$color-amber` at 50%, `$color-bg-2`. */
const CURRENT_EDGE = 'rgb(79, 88, 157)';
const CURRENT_HEADER = 'rgb(27, 33, 48)';
const ACCENT = 'rgb(123, 135, 247)';
const AMBER_HALF = 'rgba(210, 153, 34, 0.5)';
const BG_2 = 'rgb(21, 27, 35)';

/** The card's head: the paragraph the login is in. */
function getHead(login: string) {
    const head = page.getByText(login, { exact: true }).element().parentElement;
    expect(head?.tagName).toBe('P');
    return head!;
}

/** The one of the elements reading `text` the reader sees: a review's threads are drawn in both places, one hidden. */
function getShown(text: string) {
    const shown = page
        .getByText(text, { exact: true })
        .elements()
        .filter(element => element.checkVisibility());
    expect(shown).toHaveLength(1);
    return shown[0] as HTMLElement;
}

/** The avatar starting the head, and the one in the gutter beside the card. */
function getAvatars(head: HTMLElement) {
    const root = head.parentElement?.parentElement;
    return { inHead: head.firstElementChild, inGutter: root?.firstElementChild?.firstElementChild };
}

test('narrow, the avatar starts the head and the gutter goes; the age stands without the verb', async () => {
    await Narrow.run();
    const login = Narrow.args.author?.login ?? '';
    const head = getHead(login);
    const { inHead, inGutter } = getAvatars(head);

    expect(inHead?.checkVisibility()).toBe(true);
    expect(inGutter?.checkVisibility()).toBe(false);
    expect(head.textContent).toContain('commented');
    await expect.element(page.getByText(/^commented /)).not.toBeVisible();
});

test('wide, the avatar is in the gutter, the verb before the age, the threads at the head’s end', async () => {
    await WideReview.run();
    const head = getHead(WideReview.args.author?.login ?? '');
    const { inHead, inGutter } = getAvatars(head);

    expect(inHead?.checkVisibility()).toBe(false);
    expect(inGutter?.checkVisibility()).toBe(true);
    expect(head.contains(getShown('2 threads · 1 resolved'))).toBe(true);
});

test('a very long login on a narrow review is cut short: nothing overflows, the ⋯ stays, the threads go under the text', async () => {
    await NarrowLongLogin.run();
    const login = NarrowLongLogin.args.author?.login ?? '';
    const head = getHead(login);
    const author = page.getByText(login, { exact: true }).element() as HTMLElement;
    const frame = page.getByTestId('frame').element() as HTMLElement;
    const more = page.getByRole('button', { name: 'Comment actions' });

    expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth);
    expect(head.scrollWidth).toBeLessThanOrEqual(head.clientWidth);
    expect(author.scrollWidth).toBeGreaterThan(author.clientWidth);
    await expect.element(more).toBeVisible();
    expect(more.element().getBoundingClientRect().right).toBeLessThanOrEqual(head.getBoundingClientRect().right);
    await expect.element(page.getByText('requested changes')).toBeVisible();

    expect(head.contains(getShown('2 threads · 1 resolved'))).toBe(false);
});

test("at the thread's widest the threads follow the time 6px after it while the ⋯ stays at the card's edge", async () => {
    await WidestReview.run();
    const head = getHead(WidestReview.args.author?.login ?? '');
    const time = head.querySelector('time')?.getBoundingClientRect();
    const tail = getShown('2 threads · 1 resolved').parentElement?.getBoundingClientRect();
    if (!time || !tail) {
        throw new Error('The head has no time or no threads.');
    }

    expect(tail.left - time.right).toBeCloseTo(6, 0);
    expect(tail.right).toBeLessThan(head.getBoundingClientRect().right - 300);
    const more = page.getByRole('button', { name: 'Comment actions' }).element().getBoundingClientRect();
    expect(more.right).toBeGreaterThan(head.getBoundingClientRect().right - 20);
});

test('under the reading cursor the card is the current one: its border current-edge, its head current-header', async () => {
    await Current.run();
    const head = getHead(Current.args.author?.login ?? '');

    expect(getStop()?.getAttribute('aria-current')).toBe('true');
    expect(getComputedStyle(assertCard(head)).borderTopColor).toBe(CURRENT_EDGE);
    expect(getComputedStyle(head).backgroundColor).toBe(CURRENT_HEADER);
});

test('a card around the cursor is marked as the one under it, both aria-current', async () => {
    await Within.run();
    const head = getHead(Within.args.author?.login ?? '');

    expect(getStop()?.getAttribute('aria-current')).toBe('true');
    expect(getComputedStyle(assertCard(head)).borderTopColor).toBe(CURRENT_EDGE);
    expect(getComputedStyle(head).backgroundColor).toBe(CURRENT_HEADER);
});

test('a linked card has the accent border without a cursor and none with one; a draft keeps its amber', async () => {
    await Linked.run();
    expect(getComputedStyle(assertCard(getHead(Linked.args.author?.login ?? ''))).borderTopColor).toBe(ACCENT);

    await CurrentLinked.run();
    const linked = getHead(CurrentLinked.args.author?.login ?? '');
    expect(getComputedStyle(assertCard(linked)).borderTopColor).toBe(CURRENT_EDGE);
    expect(getComputedStyle(linked).backgroundColor).toBe(CURRENT_HEADER);

    await CurrentPending.run();
    const pending = getHead('Your review');
    expect(getComputedStyle(assertCard(pending)).borderTopColor).toBe(AMBER_HALF);
    expect(getComputedStyle(pending).backgroundColor).toBe(CURRENT_HEADER);
});

test("a stop the cursor is not on, and a card that is no stop (code review's conversation), are not marked", async () => {
    await NotCurrent.run();
    expect(getStop()?.hasAttribute('aria-current')).toBe(false);
    expect(getComputedStyle(getHead(NotCurrent.args.author?.login ?? '')).backgroundColor).toBe(BG_2);

    await NotAStop.run();
    const head = getHead(NotAStop.args.author?.login ?? '');
    expect(getStop()).toBeNull();
    expect(document.querySelector('[aria-current]')).toBeNull();
    expect(getComputedStyle(head).backgroundColor).toBe(BG_2);
    expect(getComputedStyle(assertCard(head)).borderTopColor).not.toBe(CURRENT_EDGE);
});

function getStop() {
    return document.querySelector('[data-reading-stop]');
}

/** The card around a head. */
function assertCard(head: HTMLElement) {
    const card = head.parentElement;
    expect(card).not.toBeNull();
    return card!;
}
