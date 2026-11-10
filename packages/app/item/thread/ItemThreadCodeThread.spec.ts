import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ItemThreadCodeThread.stories.js';

const { Open, Resolved, ReadOnly, ResolvedCannotUnresolve, Draft, LongLine } = composeStories(stories);

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
