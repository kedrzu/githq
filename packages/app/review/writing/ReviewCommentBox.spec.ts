import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ReviewCommentBox.stories.js';

const { DraftOpen, Empty, Reply, ReplyDraftFound, SingleFirst, WithSuggestion } = composeStories(stories);

test('⌘↵ and ⌘⇧↵ do what the buttons say, and with a draft open neither is a comment on its own', async () => {
    const onSend = vi.fn();
    await DraftOpen.run({ args: { ...DraftOpen.args, onSend } });

    await userEvent.click(page.getByRole('textbox'));
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await userEvent.keyboard('{ControlOrMeta>}{Shift>}{Enter}{/Shift}{/ControlOrMeta}');

    expect(onSend.mock.calls).toEqual([['joinDraft'], ['joinAndSubmit']]);
    await expect.element(page.getByRole('button', { name: 'Submit draft (4 comments)' })).toBeVisible();
});

test('single keys stay in the field, and Escape on an empty box only says so', async () => {
    const onLeave = vi.fn();
    await SingleFirst.run({ args: { ...SingleFirst.args, onLeave, text: '' } });

    await userEvent.click(page.getByRole('textbox'));
    await userEvent.keyboard('{Escape}');
    expect(onLeave).toHaveBeenCalledOnce();

    await userEvent.keyboard('jnvJ');
    await expect.element(page.getByRole('textbox')).toHaveValue('jnvJ');
});

test('nothing typed sends nothing', async () => {
    const onSend = vi.fn();
    await Empty.run({ args: { ...Empty.args, onSend } });

    await userEvent.click(page.getByRole('textbox'));
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    expect(onSend).not.toHaveBeenCalled();
    await expect.element(page.getByRole('button', { name: 'Comment' })).toBeDisabled();
});

test('⌘G puts the block on a line of its own at the cursor, its lines as they are, and no key leaves the box', async () => {
    await WithSuggestion.run();
    const field = page.getByRole('textbox');

    await userEvent.click(field);
    await userEvent.keyboard('{ControlOrMeta>}g{/ControlOrMeta}');

    await expect.element(field).toHaveValue('Bound it.\n```suggestion\n    const left = max;\n\treturn left;\n```');
});

test('Suggest a change in the tools puts the block where the cursor was, and the cursor goes back into the text', async () => {
    await WithSuggestion.run({ args: { ...WithSuggestion.args, text: 'Bound it. Done.' } });
    const field = page.getByRole('textbox');

    await userEvent.click(field);
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    await userEvent.click(page.getByRole('button', { name: 'Suggest a change' }));

    await expect
        .element(field)
        .toHaveValue('Bound it.\n```suggestion\n    const left = max;\n\treturn left;\n```\n Done.');
    await expect.element(field).toHaveFocus();
});

test('Cancel closes an empty box as Escape does', async () => {
    const onLeave = vi.fn();
    await Empty.run({ args: { ...Empty.args, onLeave } });

    await userEvent.click(page.getByRole('button', { name: /^Cancel/ }));

    expect(onLeave).toHaveBeenCalledOnce();
});

test('Escape on a box with text asks in its footer; Enter in the text discards, not a new line', async () => {
    const onLeave = vi.fn();
    const onDiscard = vi.fn();
    await SingleFirst.run({ args: { ...SingleFirst.args, onLeave, onDiscard } });
    const field = page.getByRole('textbox');

    await userEvent.click(field);
    await userEvent.keyboard('{Escape}');

    await expect.element(page.getByRole('status').filter({ hasText: 'Discard what you wrote?' })).toBeVisible();
    await expect.element(field).toHaveFocus();
    await expect.element(field).toHaveAttribute('aria-keyshortcuts', 'Enter Escape');
    await userEvent.keyboard('{Enter}');

    expect(onDiscard).toHaveBeenCalledOnce();
    expect(onLeave).not.toHaveBeenCalled();
    await expect.element(field).toHaveValue(SingleFirst.args.text ?? '');
});

test('while it asks, Enter on Keep writing keeps writing: only Enter in the text discards', async () => {
    const onDiscard = vi.fn();
    await SingleFirst.run({ args: { ...SingleFirst.args, onDiscard } });
    const field = page.getByRole('textbox');
    const question = page.getByText('Discard what you wrote?');

    await userEvent.click(field);
    await userEvent.keyboard('{Escape}');
    await userEvent.tab();
    await expect.element(page.getByRole('button', { name: /^Keep writing/ })).toHaveFocus();
    await userEvent.keyboard('{Enter}');

    await expect.element(question).not.toBeInTheDocument();
    await expect.element(field).toHaveFocus();
    expect(onDiscard).not.toHaveBeenCalled();
});

test('typing takes the question away, Escape on it keeps writing, and Cancel asks as Escape does', async () => {
    const onDiscard = vi.fn();
    const onSend = vi.fn();
    await SingleFirst.run({ args: { ...SingleFirst.args, onDiscard, onSend } });
    const field = page.getByRole('textbox');
    const question = page.getByText('Discard what you wrote?');

    await userEvent.click(field);
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('x');
    await expect.element(question).not.toBeInTheDocument();

    await userEvent.keyboard('{Escape}{Escape}');
    await expect.element(question).not.toBeInTheDocument();
    await expect.element(field).toHaveFocus();

    await userEvent.click(page.getByRole('button', { name: /^Cancel/ }));
    await expect.element(question).toBeVisible();
    await expect.element(field).toHaveFocus();
    await userEvent.click(page.getByRole('button', { name: /^Keep writing/ }));
    await expect.element(question).not.toBeInTheDocument();
    expect(onDiscard).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
});

test('with nothing GitHub would take, there is no offer and ⌘G adds nothing', async () => {
    await SingleFirst.run({ args: { ...SingleFirst.args, text: 'Why?' } });

    await expect.element(page.getByRole('button', { name: /Suggest a change/ })).not.toBeInTheDocument();
    await userEvent.click(page.getByRole('textbox'));
    await userEvent.keyboard('{ControlOrMeta>}g{/ControlOrMeta}');
    await expect.element(page.getByRole('textbox')).toHaveValue('Why?');
});

test('⇧↓ asks for the next line only while the box is empty; with text it selects text', async () => {
    const onExtend = vi.fn();
    await Empty.run({ args: { ...Empty.args, onExtend } });
    await userEvent.click(page.getByRole('textbox'));

    await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}');
    expect(onExtend).toHaveBeenCalledOnce();

    await userEvent.keyboard('text{Shift>}{ArrowDown}{/Shift}');
    expect(onExtend).toHaveBeenCalledOnce();
});

test('a reply says who it answers and what its keys do', async () => {
    const onSend = vi.fn();
    await Reply.run({ args: { ...Reply.args, onSend } });

    await expect
        .element(page.getByRole('paragraph').filter({ hasText: 'Reply to sofiab and claude[bot]' }))
        .toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Start a review' })).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: /^Reply/ }));
    expect(onSend).toHaveBeenCalledWith('single');
});

test('a reply that met a draft says nothing went out, and now joins it', async () => {
    const onSend = vi.fn();
    await ReplyDraftFound.run({ args: { ...ReplyDraftFound.args, onSend } });

    await expect.element(page.getByRole('alert')).toHaveTextContent(/nothing was sent/);
    await userEvent.click(page.getByRole('textbox'));
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    expect(onSend).toHaveBeenCalledWith('joinDraft');
});
