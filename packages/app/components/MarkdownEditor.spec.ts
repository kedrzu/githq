import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { waitFor } from '@nzyme/utils/waitFor.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { composeStories } from '@storybook/vue3';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, h, ref } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { RenderMarkdownCommand } from '@/services/RenderMarkdownCommand.js';
import type { RenderMarkdownCommandShape } from '@/services/RenderMarkdownCommand.js';

import MarkdownEditor from './MarkdownEditor.vue';
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

test('moved to another item on Preview, it shows that item’s text rendered in its own repository, never the last one', async () => {
    const { view, ...item } = mountMovingEditor({ text: 'Fixed in #12', repository: 'acme/web' });
    await userEvent.click(view.getByRole('tab', { name: 'Preview' }));
    await expect.element(view.getByText('acme/web: Fixed in #12')).toBeVisible();

    // The same text, in another repository: its #12 is another one.
    item.repository.value = 'acme/api';
    await expect.element(view.getByText('acme/api: Fixed in #12')).toBeVisible();
    await expect.element(view.getByText('acme/web: Fixed in #12')).not.toBeInTheDocument();

    // Another text: the last item's rendering does not stay while this one's is on its way.
    item.text.value = 'Duplicate of #3';
    await expect.element(view.getByText('acme/api: Fixed in #12')).not.toBeInTheDocument();
    await expect.element(view.getByText('acme/api: Duplicate of #3')).toBeVisible();
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

/**
 * The editor as the item view holds it: its text and repository the opened item's, changed under it when the user
 * moves on; GitHub rendering a text as `repository: text`, a moment later.
 */
function mountMovingEditor(initial: { text: string; repository: string }) {
    const text = ref(initial.text);
    const repository = ref(initial.repository);
    const render: RenderMarkdownCommandShape = async params => {
        await waitFor(50);
        return `<p>${params.context}: ${params.text}</p>`;
    };
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(RenderMarkdownCommand, render);
    const app = createApp({
        setup: () => () =>
            h(MarkdownEditor, {
                label: 'Comment',
                modelValue: text.value,
                repository: repository.value,
                'onUpdate:modelValue': (value: string | null | undefined) => {
                    text.value = value ?? '';
                },
            }),
    });
    app.use(IocPlugin, { container });
    const root = document.createElement('div');
    root.setAttribute('tid', 'moving-editor');
    document.body.append(root);
    app.mount(root);
    onTestFinished(() => {
        app.unmount();
        root.remove();
    });

    return { text, repository, view: page.getByTestId('moving-editor') };
}
