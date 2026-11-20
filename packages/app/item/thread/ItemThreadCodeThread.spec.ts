import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ItemThreadCodeThread.stories.js';

const {
    Open,
    Resolved,
    ReadOnly,
    ResolvedCannotUnresolve,
    Draft,
    LongLine,
    CurrentComment,
    Current,
    CurrentResolved,
    CursorElsewhere,
    Linked,
    CurrentLinkedComment,
} = composeStories(stories);

/** `$color-current-edge`, `$color-accent`, `$color-border-2`. */
const CURRENT_EDGE = 'rgb(79, 88, 157)';
const ACCENT = 'rgb(123, 135, 247)';
const BORDER_2 = 'rgb(61, 68, 77)';

test('Reply… and Resolve thread are offered only where GitHub lets the viewer reply and resolve', async () => {
    await Open.run();
    await expect.element(page.getByRole('button', { name: 'Reply…' })).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Resolve thread' }));
    expect(Open.args.onSetResolved).toHaveBeenLastCalledWith(true);

    await ReadOnly.run();
    await expect.element(page.getByText('Right, migrating now instead of clearing.')).toBeVisible();
    expect(page.getByRole('button', { name: 'Reply…' }).query()).toBeNull();
    expect(page.getByRole('button', { name: 'Resolve thread' }).query()).toBeNull();
});

test('Unresolve is offered only where GitHub lets the viewer open it again; who resolved it shows either way', async () => {
    await Resolved.run();
    await userEvent.click(page.getByRole('button', { name: 'Unresolve' }));
    expect(Resolved.args.onSetResolved).toHaveBeenLastCalledWith(false);

    await ResolvedCannotUnresolve.run();
    await expect.element(page.getByText('mlaine marked this thread as resolved.')).toBeVisible();
    expect(page.getByRole('button', { name: 'Unresolve' }).query()).toBeNull();
    // Replying is GitHub's own call, apart from resolving.
    await expect.element(page.getByRole('button', { name: 'Reply…' })).toBeVisible();
});

test('a thread of the viewer’s draft has neither Reply… nor Resolve, whatever GitHub allows', async () => {
    await Draft.run();

    await expect.element(page.getByText('Pending')).toBeVisible();
    expect(page.getByRole('button', { name: 'Reply…' }).query()).toBeNull();
    expect(page.getByRole('button', { name: 'Resolve thread' }).query()).toBeNull();
});

test('a line wider than the card scrolls sideways in its frame, the card keeping its width', async () => {
    await LongLine.run();

    const thread = page.getByRole('group', { name: /^Thread by mlaine/u }).element();
    const code = page.getByRole('region', { name: 'Code of src/sync/engine.ts' }).element();
    // The story's frame: 440 wide, padded 16 each side.
    expect(thread.getBoundingClientRect().width).toBe(408);
    expect(code.scrollWidth).toBeGreaterThan(code.clientWidth);
});

test('the cursor on a comment marks the comment and the card around it; on the card, the card alone', async () => {
    await CurrentComment.run();
    expect(getStops()).toEqual([
        ['thread:T_db', 'true'],
        ['T_db_0', null],
        ['T_db_1', 'true'],
    ]);
    expect(getComputedStyle(getCard()).borderTopColor).toBe(CURRENT_EDGE);

    await Current.run();
    expect(getStops()).toEqual([
        ['thread:T_db', 'true'],
        ['T_db_0', null],
        ['T_db_1', null],
    ]);
    expect(getComputedStyle(getCard()).borderTopColor).toBe(CURRENT_EDGE);

    await CursorElsewhere.run();
    expect(getStops().map(([, current]) => current)).toEqual([null, null, null]);
    expect(getComputedStyle(getCard()).borderTopColor).toBe(BORDER_2);
});

test('with the cursor on the thread or in it, Reply… shows R and Resolve thread or Unresolve H; elsewhere neither', async () => {
    await CurrentComment.run();
    expectHint('Reply…', 'R');
    expectHint('Resolve thread', 'H');

    await Current.run();
    expectHint('Reply…', 'R');
    expectHint('Resolve thread', 'H');

    await CurrentResolved.run();
    expectHint('Unresolve', 'H');

    await CursorElsewhere.run();
    expectHint('Reply…', null);
    expectHint('Resolve thread', null);
});

test('the linked comment is the location in the accent border without a cursor; with one, only where it starts', async () => {
    await Linked.run();
    expect(document.querySelector('[data-reading-stop="T_db_1"]')?.getAttribute('aria-current')).toBe('location');
    expect(getComputedStyle(getCard()).borderTopColor).toBe(ACCENT);

    await CurrentLinkedComment.run();
    expect(document.querySelector('[data-reading-stop="T_db_1"]')?.getAttribute('aria-current')).toBe('true');
    expect(document.querySelector('[aria-current="location"]')).toBeNull();
    expect(getComputedStyle(getCard()).borderTopColor).toBe(CURRENT_EDGE);
});

/** Each stop's key and `aria-current`, in document order: the card first, then its comments. */
function getStops() {
    return [...document.querySelectorAll('[data-reading-stop]')].map(stop => [
        stop.getAttribute('data-reading-stop'),
        stop.getAttribute('aria-current'),
    ]);
}

function getCard() {
    return page.getByRole('group', { name: /^Thread by / }).element();
}

/** The button's key: drawn beside its label and named to assistive tech, or neither. */
function expectHint(name: string, key: string | null) {
    const button = page.getByRole('button', { name, exact: true }).element();
    expect(button.getAttribute('aria-keyshortcuts')).toBe(key);
    expect(button.querySelector('kbd') !== null).toBe(key !== null);
}
