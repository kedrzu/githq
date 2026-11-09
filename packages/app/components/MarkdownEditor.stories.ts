import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import type { Fetch } from '@nzyme/types/Fetch.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { GitPullRequestClosed } from 'lucide-vue-next';
import { userEvent, within } from 'storybook/test';
import { ref } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';

import Button from './Button.vue';
import MarkdownEditor from './MarkdownEditor.vue';

/** What the user typed in `Activity / Composer · writing`. */
const TYPED = [
    'Thanks both. The cross-repository case is fixed in 3f2a9b1 and the e2e is green again.',
    '',
    '@sofiab could you take another look?',
    '',
    'The migration is the only part that changed since your review.',
].join('\n');

/** GitHub's rendering of {@link TYPED}. */
const RENDERED = [
    '<p dir="auto">Thanks both. The cross-repository case is fixed in <a href="https://github.com/mlaine/tasklet/commit/3f2a9b1"><tt>3f2a9b1</tt></a> and the e2e is green again.</p>',
    '<p dir="auto"><a class="user-mention notranslate" href="https://github.com/sofiab">@sofiab</a> could you take another look?</p>',
    '<p dir="auto">The migration is the only part that changed since your review.</p>',
].join('\n');

/** GitHub answering `POST /markdown` with {@link RENDERED}, and nothing else. */
const RENDERING: Fetch = input =>
    Promise.resolve(
        new URL(input instanceof Request ? input.url : input).pathname === '/markdown'
            ? new Response(RENDERED, { headers: { 'Content-Type': 'text/html' } })
            : Response.json({ message: 'Server Error' }, { status: 502 }),
    );

const meta = {
    component: MarkdownEditor,
    args: { modelValue: '', repository: 'mlaine/tasklet', label: 'Comment', placeholder: 'Leave a comment…' },
    parameters: { github: RENDERING },
    // A composer's editor, as wide as a page's thread, with its buttons; over a GitHub answering `parameters.github`.
    render: ({ modelValue, ...args }, { parameters }) => ({
        components: { Button, MarkdownEditor },
        setup() {
            const container = createContainer();
            container.set(LanguageContext, () => APP_LANGUAGE);
            container.set(Browser, createSignedInBrowser(parameters.github));
            provideContainer(container);
            const text = ref(modelValue ?? '');
            return { args, text, GitPullRequestClosed };
        },
        template: `
          <div style="width: 680px; padding: 20px; background: #11161c">
            <MarkdownEditor v-bind="args" v-model="text">
              <template #footer>
                <Button size="compact" :icon="GitPullRequestClosed" kbd="Shift+X">Close pull request</Button>
                <Button size="compact" variant="primary" kbd="Mod+Enter" :unavailable="!text.trim()">Comment</Button>
              </template>
            </MarkdownEditor>
          </div>`,
    }),
} satisfies Meta<typeof MarkdownEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Activity / Editor`: nothing typed yet, Comment dimmed. */
export const Empty: Story = {};

/** `Activity / Composer · writing`: text typed. */
export const Typed: Story = { args: { modelValue: TYPED } };

/** `Activity / Editor · preview`: GitHub's rendering of the text, the tools hidden. */
export const Preview: Story = {
    args: { modelValue: TYPED },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.click(canvas.getByRole('tab', { name: 'Preview' }));
        await canvas.findByRole('link', { name: '@sofiab' });
    },
};

/** The preview GitHub could not render: said quietly, the text kept for the Write tab. */
export const PreviewFailed: Story = {
    args: { modelValue: TYPED },
    parameters: {
        github: (() => Promise.resolve(Response.json({ message: 'Server Error' }, { status: 502 }))) satisfies Fetch,
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.click(canvas.getByRole('tab', { name: 'Preview' }));
        await canvas.findByText("The preview couldn't be loaded.", { exact: false });
    },
};
