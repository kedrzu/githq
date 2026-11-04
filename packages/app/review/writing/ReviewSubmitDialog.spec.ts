import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ReviewSubmitDialog.stories.js';

const { Approve, Comment } = composeStories(stories);

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
