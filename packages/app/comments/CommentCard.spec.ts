import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import * as stories from './CommentCard.stories.js';

const { Narrow, NarrowLongLogin, WideReview } = composeStories(stories);

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
