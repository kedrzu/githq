import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { sampleThread } from '@/testing/sampleThreads.js';

import * as stories from './ReviewThreadBox.stories.js';

const { DeleteRefused, Focused, Open, Outdated, WithMenu } = composeStories(stories);

/** `$color-fg`: the card text colour. */
const FG = 'rgb(240, 246, 252)';

/** The thread's parts, top to bottom. */
function getParts() {
    const thread = page.getByRole('group', { name: /^Thread by/u }).element();
    return [...thread.children] as HTMLElement[];
}

test('an open thread shows each comment in the card text colour, then a reply band and a separate resolve band', async () => {
    await Open.run();
    const [body, replyBand, resolveBand, ...rest] = getParts();

    expect(rest).toHaveLength(0);
    for (const text of ['What happens when the same workout', 'Both are kept on purpose.']) {
        const comment = page.getByText(new RegExp(`^${text}`, 'u')).element();
        expect(body?.contains(comment)).toBe(true);
        expect(getComputedStyle(comment).color).toBe(FG);
    }

    expect(replyBand?.querySelector('button')?.textContent?.trim()).toBe('Reply…');
    expect(replyBand?.textContent).not.toContain('Resolve');
    expect(resolveBand?.querySelector('button')?.textContent?.trim()).toBe('Resolve thread');
    expect(resolveBand?.textContent).not.toContain('Reply');
});

test('Reply… shows its key only on the focused thread', async () => {
    await Open.run();
    await expect.element(page.getByRole('button', { name: 'Reply…' })).not.toHaveAttribute('aria-keyshortcuts');

    await Focused.run();
    await expect.element(page.getByRole('button', { name: /^Reply…/u })).toHaveAttribute('aria-keyshortcuts', 'R');
});

test('an outdated thread says how it was placed in a head band above the comments', async () => {
    await Outdated.run();
    const [head, body] = getParts();

    expect(head?.textContent).toContain('Outdated');
    expect(head?.textContent).toContain('so the place is approximate');
    expect(body?.textContent).toContain('Both are kept on purpose.');
});

test('a deletion GitHub didn’t take says why in the resolve band', async () => {
    await DeleteRefused.run();
    const resolveBand = getParts().at(-1);

    await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent("Couldn't delete the comment: GitHub wasn't reached.");
    expect(resolveBand?.contains(page.getByRole('alert').element())).toBe(true);
});

test('a comment offers Quote reply only where its thread takes a reply', async () => {
    await WithMenu.run();
    await userEvent.click(page.getByRole('button', { name: 'Comment actions' }).first());
    await expect.element(page.getByRole('menuitem', { name: 'Quote reply' })).toBeVisible();
    await userEvent.keyboard('{Escape}');

    await WithMenu.run({ args: { thread: { ...sampleThread(), viewerCanReply: false } } });
    await userEvent.click(page.getByRole('button', { name: 'Comment actions' }).first());
    await expect.element(page.getByRole('menuitem', { name: 'Copy link' })).toBeVisible();
    expect(page.getByRole('menuitem', { name: 'Quote reply' }).query()).toBeNull();
});
