import type { ReferenceSearchQuery } from '@githq/github/generated.gen.js';
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
import { sampleUser } from '@/testing/sampleMyWork.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

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

/** The people of `Activity / Mention menu`, as a thread's. */
const PEOPLE = [
    { ...sampleUser('sofiab', '#7fb3d5'), name: 'Sofia Berg' },
    { ...sampleUser('sren-dev', '#e8a87c'), name: 'Søren Holm' },
    { ...sampleUser('sophie-k', '#b39ddb'), name: 'Sophie Klein' },
    { ...sampleUser('mlaine', '#81c995'), name: 'Mikko Laine' },
];

/** What GitHub's search finds in mlaine/tasklet, which the stories' user does not track. */
const FOUND: ReferenceSearchQuery = {
    search: {
        nodes: [
            {
                __typename: 'Issue',
                number: 12,
                title: 'Sub-issue links are lost when the parent is in another repository',
                issueState: 'OPEN',
                stateReason: null,
            },
            {
                __typename: 'PullRequest',
                number: 14,
                title: 'Store project items next to issues',
                pullRequestState: 'OPEN',
                isDraft: false,
                merged: false,
            },
            {
                __typename: 'Issue',
                number: 11,
                title: 'Lists flash empty before the store opens',
                issueState: 'CLOSED',
                stateReason: 'COMPLETED',
            },
            {
                __typename: 'Issue',
                number: 10,
                title: 'Rebuild links on every sync',
                issueState: 'OPEN',
                stateReason: null,
            },
        ],
    },
};

/** GitHub answering `POST /markdown` with {@link RENDERED} and the search for issues with {@link FOUND}, nothing else. */
const RENDERING: Fetch = (input, init) => {
    const { pathname } = new URL(input instanceof Request ? input.url : input);
    if (pathname === '/markdown') {
        return Promise.resolve(new Response(RENDERED, { headers: { 'Content-Type': 'text/html' } }));
    }

    if (pathname === '/graphql' && typeof init?.body === 'string' && init.body.includes('query ReferenceSearch')) {
        return Promise.resolve(Response.json({ data: FOUND }));
    }

    return Promise.resolve(Response.json({ message: 'Server Error' }, { status: 502 }));
};

const meta = {
    component: MarkdownEditor,
    args: {
        modelValue: '',
        repository: 'mlaine/tasklet',
        label: 'Comment',
        placeholder: 'Leave a comment…',
        people: PEOPLE,
    },
    parameters: { github: RENDERING },
    // A composer's editor, as wide as a page's thread, with its buttons; over a GitHub answering `parameters.github`.
    render: ({ modelValue, ...args }, { parameters }) => ({
        components: { Button, MarkdownEditor },
        setup() {
            const container = createContainer();
            container.set(LanguageContext, () => APP_LANGUAGE);
            container.set(Browser, createSignedInBrowser(parameters.github));
            setIndexedDbPersistence(container);
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

/** `Activity / Mention menu` at the caret: `@so` typed, the thread's people found by login and name. */
export const Mentioning: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.type(canvas.getByRole('textbox', { name: 'Comment' }), 'Thanks @so');
        await within(document.body).findByRole('option', { name: /sophie-k/u });
    },
};

/** `Activity / Reference menu` at the caret: `#1` typed, the issues and pull requests GitHub's search found. */
export const Referencing: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.type(canvas.getByRole('textbox', { name: 'Comment' }), 'Fixed in #1');
        await within(document.body).findByRole('option', { name: /#12/u });
    },
};
