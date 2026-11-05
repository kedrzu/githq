import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ReviewSubmitDialog.stories.js';

const { Approve, Comment, NoDraftApprove, NoDraftComment, NoDraftCommentWritten, NoDraftRequestChanges } =
    composeStories(stories);

test('1 2 3 choose once out of the field, stay typed in it, and ⌘↵ sends from either', async () => {
    const choices: unknown[] = [];
    const onSubmit = vi.fn();
    await Comment.run({
        args: {
            ...Comment.args,
            onSubmit,
            'onUpdate:choice': choice => choices.push(choice),
        },
    });

    await userEvent.keyboard('2');
    expect(choices).toEqual([{ event: 'COMMENT', body: '2' }]);

    await userEvent.keyboard('{Tab}3');
    expect(choices.at(-1)).toEqual({ event: 'REQUEST_CHANGES', body: '' });

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    expect(onSubmit).toHaveBeenCalledOnce();
});

test('the button takes the choice’s name', async () => {
    await Comment.run();
    await expect.element(page.getByRole('button', { name: 'Submit review' })).toBeVisible();

    await Approve.run();
    await expect.element(page.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
});

test('a quick arrow press chooses, not only moves', async () => {
    const choices: unknown[] = [];
    await Comment.run({ args: { ...Comment.args, 'onUpdate:choice': choice => choices.push(choice) } });

    await userEvent.keyboard('{Tab}{ArrowRight}');

    expect(choices.at(-1)).toEqual({ event: 'APPROVE', body: '' });
});

test('on a busy main thread, the card just left does not take back what the arrow chose', async () => {
    const choices: unknown[] = [];
    await Comment.run({ args: { ...Comment.args, 'onUpdate:choice': choice => choices.push(choice) } });

    // What a busy thread does: a timer set by the focus arriving with Tab runs only once the arrow is down.
    const held: (() => void)[] = [];
    const realSetTimeout = window.setTimeout;
    const spy = vi.spyOn(window, 'setTimeout').mockImplementation(((
        callback: () => void,
        delay?: number,
        ...rest: unknown[]
    ) => {
        if (!delay) {
            held.push(callback);
            return 0;
        }
        return realSetTimeout(callback, delay, ...rest);
    }) as typeof window.setTimeout);

    try {
        await userEvent.keyboard('{Tab}');
        const heldSinceTab = held.splice(0);
        await userEvent.keyboard('{ArrowRight>}');
        heldSinceTab.forEach(callback => callback());
        await userEvent.keyboard('{/ArrowRight}');
        held.splice(0).forEach(callback => callback());
    } finally {
        spy.mockRestore();
    }

    expect(choices.at(-1)).toEqual({ event: 'APPROVE', body: '' });
});

test('with no comments a comment or changes requested need text, and the button says why; ⌘↵ sends nothing', async () => {
    const onSubmit = vi.fn();
    await NoDraftComment.run({ args: { ...NoDraftComment.args, onSubmit } });

    const needs = page.getByRole('button', { name: 'Write a comment first' });
    await expect.element(needs).toBeDisabled();
    await expect.element(page.getByText('optional')).not.toBeInTheDocument();
    await expect.element(page.getByText(/pending comment/u)).not.toBeInTheDocument();
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    expect(onSubmit).not.toHaveBeenCalled();

    await NoDraftRequestChanges.run();
    await expect.element(page.getByRole('button', { name: 'Say what to change first' })).toBeDisabled();
});

test('with no comments an approval goes with no text, and a comment once it has some', async () => {
    const onSubmit = vi.fn();
    await NoDraftApprove.run({ args: { ...NoDraftApprove.args, onSubmit } });
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    expect(onSubmit).toHaveBeenCalledOnce();

    await NoDraftCommentWritten.run();
    await expect.element(page.getByRole('button', { name: 'Submit review' })).toBeEnabled();
});
