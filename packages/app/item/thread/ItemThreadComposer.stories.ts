import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import type { Fetch } from '@nzyme/types/Fetch.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import { provideContext } from '@nzyme/vue-utils/context.js';
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { fn, userEvent, within } from 'storybook/test';
import { defineComponent, h, ref } from 'vue';

import { KeyHintsContext } from '@/components/KeyHintsContext.js';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import { createFixedPhoneLayout } from '@/testing/createFixedPhoneLayout.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { D1_ISSUE, F1_PULL_REQUEST } from '@/testing/sampleItemDetails.js';
import { sampleUser } from '@/testing/sampleMyWork.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { withPhoneLayout } from '@/testing/withPhoneLayout.js';

import ItemThreadComposer from './ItemThreadComposer.vue';

/** What the user typed in `Activity / Composer · issue, writing`. */
const TYPED = 'Fixed by #15: the migration keeps sub-issue links whose parent lives in another repository.';

/** What the user types on a phone (mobile MB237, MB238). */
const TYPED_ON_PHONE = 'Same here on mobile. The series start is stored in local time.\n\n#1205 does both.';

/** GitHub's rendering of {@link TYPED_ON_PHONE}. */
const RENDERED_ON_PHONE = [
    '<p dir="auto">Same here on mobile. The series start is stored in local time.</p>',
    '<p dir="auto"><a class="issue-link" href="https://github.com/skyline-labs/portal/issues/1205">#1205</a> does both.</p>',
].join('\n');

/** The thread's people, whom `@` suggests first (mobile MB239). */
const PEOPLE = [sampleUser('sbrandt', '#7fb3d5'), sampleUser('sanders', '#e8a87c'), sampleUser('sofiab', '#b39ddb')];

const meta = {
    component: ItemThreadComposer,
    args: {
        item: D1_ISSUE,
        viewer: { login: SAMPLE_VIEWER.login, avatarUrl: SAMPLE_VIEWER.avatarUrl },
        canComment: true,
        canClose: true,
        readOnly: null,
        text: '',
        onEdit: fn(),
    },
    // At the end of a page's thread, at its reading width; what is typed kept as the item view keeps its draft.
    render: ({ text, ...args }) => ({
        components: { ItemThreadComposer },
        setup: () => ({ args, typed: ref(text ?? '') }),
        template: `<div style="width: 760px; padding: 20px; background: #11161c"><ItemThreadComposer v-bind="args" v-model:text="typed" /></div>`,
    }),
    // The story frame is narrower than a phone's width: the computer's menus unless a story says otherwise.
    decorators: [withPhoneLayout(false)],
} satisfies Meta<typeof ItemThreadComposer>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Activity / Composer · issue`: "Close issue" with its menu of reasons, Comment dimmed. */
export const OpenIssue: Story = {};

/** `Activity / Composer · issue, writing`: text typed, "Close with comment". */
export const OpenIssueWriting: Story = { args: { text: TYPED } };

/** `Activity / Composer`: an open pull request, "Close pull request". */
export const OpenPullRequest: Story = { args: { item: F1_PULL_REQUEST } };

/** `Activity / Composer · closed`: "Reopen issue". */
export const ClosedIssue: Story = { args: { item: { ...D1_ISSUE, state: 'CLOSED', stateReason: 'COMPLETED' } } };

/** `Activity / Composer · closed`, on a pull request: "Reopen pull request". */
export const ClosedPullRequest: Story = { args: { item: { ...F1_PULL_REQUEST, state: 'CLOSED' } } };

/** `Activity / Composer · merged`: nothing to close. */
export const MergedPullRequest: Story = { args: { item: { ...F1_PULL_REQUEST, state: 'MERGED', merged: true } } };

/** Someone who may comment but not close: Comment alone (K1b). */
export const CommentOnly: Story = { args: { canClose: false } };

/** `Activity / Composer · read-only`: the conversation locked to collaborators. */
export const Locked: Story = { args: { canComment: false, readOnly: 'locked' } };

/** `Activity / Composer · read-only`, the repository archived. */
export const Archived: Story = { args: { canComment: false, canClose: false, readOnly: 'archived' } };

/**
 * Mobile MB236 (D51): docked above a phone's keyboard — Close issue with its reasons and Comment (dim) on top, the text,
 * then Write, Preview and bold, italic, code, link and ⋯ just above the keyboard; no key hints.
 */
export const PhoneDocked: Story = {
    args: { docked: true, people: PEOPLE },
    render: renderDocked(),
    decorators: [withPhoneComposer()],
};

/** Mobile MB237's text: written, the button reads "Close with comment", Comment lit. */
export const PhoneDockedWriting: Story = { ...PhoneDocked, args: { ...PhoneDocked.args, text: TYPED_ON_PHONE } };

/** Mobile MB238: Preview renders the text as the thread will, #1205 a link; the tools hide. */
export const PhoneDockedPreview: Story = {
    ...PhoneDockedWriting,
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.click(canvas.getByRole('tab', { name: 'Preview' }));
        await canvas.findByRole('link', { name: '#1205' });
    },
};

/** Mobile MB237: the tools' ⋯ open as a menu at the bottom — Heading, the lists, Quote, then under Insert @ and #. */
export const PhoneDockedMoreTools: Story = {
    ...PhoneDockedWriting,
    play: async ({ canvasElement }) => {
        await userEvent.click(within(canvasElement).getByRole('button', { name: 'More formatting' }));
        await within(document.body).findByRole('menuitem', { name: 'Mention someone' });
    },
};

/** Mobile MB239: `@s` typed — the people in a menu docked under the text, in the tools' place; the focus stays in the text. */
export const PhoneDockedMentioning: Story = {
    ...PhoneDocked,
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.type(canvas.getByRole('textbox', { name: 'Comment' }), 'Same here on mobile. @s');
        await canvas.findByRole('option', { name: /sbrandt/u });
    },
};

/** Mobile MB241: text written, the reasons to close as a menu at the bottom, "Close with comment" naming it. */
export const PhoneDockedCloseReason: Story = {
    ...PhoneDockedWriting,
    play: async ({ canvasElement }) => {
        await userEvent.click(within(canvasElement).getByRole('button', { name: /^More ways to\sclose$/u }));
        await within(document.body).findByRole('menuitem', { name: /^Close as\snot planned/u });
    },
};

/** A closed issue, docked on a phone: Reopen issue beside Comment. */
export const PhoneDockedClosedIssue: Story = {
    ...PhoneDocked,
    args: { ...PhoneDocked.args, item: { ...D1_ISSUE, state: 'CLOSED', stateReason: 'COMPLETED' } },
};

/** Mobile MB243: an open pull request, docked on a phone — Close pull request in red, with no menu. */
export const PhoneDockedPullRequest: Story = {
    ...PhoneDocked,
    args: { ...PhoneDocked.args, item: F1_PULL_REQUEST },
};

/** Docked at the bottom of a phone's screen (390 wide), its keyboard under it; what is typed kept as the item view keeps it. */
function renderDocked(): NonNullable<Meta<typeof ItemThreadComposer>['render']> {
    return ({ text, ...args }) => ({
        components: { ItemThreadComposer },
        setup: () => ({ args, typed: ref(text ?? '') }),
        template: `
          <div style="display: flex; flex-direction: column; justify-content: flex-end; width: 390px; height: 600px; background: #11161c">
            <div style="display: flex; flex-direction: column; background: #161b22">
              <ItemThreadComposer v-bind="args" v-model:text="typed" />
            </div>
          </div>`,
    });
}

/**
 * The phone's layout inside an item, which draws no key hints (mobile D52), over a GitHub that renders {@link TYPED_ON_PHONE} for the preview and answers nothing else: the
 * people `@` suggests are the thread's.
 */
function withPhoneComposer(): Decorator {
    const github: Fetch = input => {
        const { pathname } = new URL(input instanceof Request ? input.url : input);
        return Promise.resolve(
            pathname === '/markdown'
                ? new Response(RENDERED_ON_PHONE, { headers: { 'Content-Type': 'text/html' } })
                : Response.json({ message: 'Server Error' }, { status: 502 }),
        );
    };

    return story =>
        defineComponent({
            setup() {
                const container = createContainer();
                container.set(LanguageContext, () => APP_LANGUAGE);
                container.set(Browser, createSignedInBrowser(github));
                container.set(PhoneLayout, createFixedPhoneLayout(true));
                setIndexedDbPersistence(container);
                provideContainer(container);
                provideContext(KeyHintsContext, { hidden: true });
                return () => h(story());
            },
        });
}
