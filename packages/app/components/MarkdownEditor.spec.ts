import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './MarkdownEditor.stories.js';

const { Empty, PreviewFailed, Typed } = composeStories(stories);

test("Preview shows GitHub's rendering without the tools; Write brings back the text as typed", async () => {
    await Empty.run();

    const text = page.getByRole('textbox', { name: 'Comment' });
    await userEvent.type(text, 'could you take another look?');
    await userEvent.click(page.getByRole('tab', { name: 'Preview' }));

    await expect.element(page.getByRole('link', { name: '@sofiab' })).toBeVisible();
    await expect.element(page.getByRole('toolbar', { name: 'Formatting' })).not.toBeInTheDocument();

    await userEvent.click(page.getByRole('tab', { name: 'Write' }));
    await expect.element(text).toHaveValue('could you take another look?');
});

test('a preview GitHub could not render says so, and the text stays as typed', async () => {
    await PreviewFailed.run();

    await expect.element(page.getByText("The preview couldn't be loaded. What you wrote is kept.")).toBeVisible();

    await userEvent.click(page.getByRole('tab', { name: 'Write' }));
    const text = page.getByRole('textbox', { name: 'Comment' });
    await expect.element(text).toHaveValue(PreviewFailed.args.modelValue);
    // The text is still the caller's to post or edit.
    await userEvent.type(text, ' Thanks!');
    await expect.element(text).toHaveValue(`${PreviewFailed.args.modelValue} Thanks!`);
});

test('a tool wraps the selection, keeps it selected, and is one undo away', async () => {
    await Empty.run();

    const text = page.getByRole('textbox', { name: 'Comment' });
    await userEvent.type(text, 'a fix here');
    // "fix" selected, from its end.
    await userEvent.keyboard('{ArrowLeft>5/}{Shift>}{ArrowLeft>3/}{/Shift}');
    await userEvent.click(page.getByRole('button', { name: 'Bold' }));

    await expect.element(text).toHaveValue('a **fix** here');
    await expect.element(text).toHaveFocus();
    await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}');
    await expect.element(text).toHaveValue('a fix here');
});

test('the tools are one stop for Tab, moved through by the arrow keys', async () => {
    await Empty.run();

    await userEvent.click(page.getByRole('tab', { name: 'Write' }));
    await userEvent.tab();
    await expect.element(page.getByRole('button', { name: 'Heading' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect.element(page.getByRole('button', { name: 'Bold' })).toHaveFocus();
    await userEvent.tab();
    await expect.element(page.getByRole('textbox', { name: 'Comment' })).toHaveFocus();
});

test('Mod+Enter and Escape inside it are reported, not acted on', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    await Typed.run({ args: { ...Typed.args, onSubmit, onCancel } });

    const text = page.getByRole('textbox', { name: 'Comment' });
    await userEvent.click(text);
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await expect.element(text).toHaveValue(Typed.args.modelValue);

    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
});
