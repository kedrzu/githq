import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ReviewCommentBox.stories.js';

const { DraftOpen, Empty, SingleFirst } = composeStories(stories);

test('⌘↵ and ⌘⇧↵ do what the buttons say, and with a draft open neither is a comment on its own', async () => {
    const onSend = vi.fn();
    await DraftOpen.run({ args: { ...DraftOpen.args, onSend } });

    await userEvent.click(page.getByRole('textbox'));
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await userEvent.keyboard('{ControlOrMeta>}{Shift>}{Enter}{/Shift}{/ControlOrMeta}');

    expect(onSend.mock.calls).toEqual([['joinDraft'], ['joinAndSubmit']]);
    await expect.element(page.getByRole('button', { name: 'Submit draft (4 comments)' })).toBeVisible();
});

test('single keys stay in the field, and Escape only says so', async () => {
    const onLeave = vi.fn();
    await SingleFirst.run({ args: { ...SingleFirst.args, onLeave, text: '' } });

    await userEvent.click(page.getByRole('textbox'));
    await userEvent.keyboard('jnvJ{Escape}');

    await expect.element(page.getByRole('textbox')).toHaveValue('jnvJ');
    expect(onLeave).toHaveBeenCalledOnce();
});

test('nothing typed sends nothing', async () => {
    const onSend = vi.fn();
    await Empty.run({ args: { ...Empty.args, onSend } });

    await userEvent.click(page.getByRole('textbox'));
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    expect(onSend).not.toHaveBeenCalled();
    await expect.element(page.getByRole('button', { name: 'Comment' })).toBeDisabled();
});
