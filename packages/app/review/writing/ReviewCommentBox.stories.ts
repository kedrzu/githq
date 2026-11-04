import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import ReviewCommentBox from './ReviewCommentBox.vue';

const TEXT = 'scheduleRetry needs a ceiling, or a dead token retries every 2 s forever.';

const meta = {
    component: ReviewCommentBox,
    args: {
        target: { id: 'box', path: 'src/sync/engine.ts', side: 'after', line: 50, startLine: null, threadId: null },
        text: TEXT,
        draftOpen: false,
        draftCount: 0,
        draftFirst: false,
        failure: null,
        focused: false,
        onSend: fn(),
        onLeave: fn(),
    },
    render: args => ({
        components: { ReviewCommentBox },
        setup: () => ({ args }),
        template: `<div style="width: 520px"><ReviewCommentBox v-bind="args" /></div>`,
    }),
} satisfies Meta<typeof ReviewCommentBox>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CR70: your default is a single comment. */
export const SingleFirst: Story = {};

/** Nothing typed: nothing to send. */
export const Empty: Story = { args: { text: '' } };

/** CR71: your default is a draft. */
export const DraftFirst: Story = { args: { draftFirst: true } };

/** CR72: a draft is open, so it can only join it, and the second key counts this one too. */
export const DraftOpen: Story = { args: { draftOpen: true, draftCount: 3 } };

/** CR73: on a range. */
export const OnRange: Story = {
    args: { target: { id: 'box', path: 'src/sync/engine.ts', side: 'after', line: 47, startLine: 44, threadId: null } },
};

const SUGGESTION = '```suggestion\n    const left = max;\n\treturn left;\n```';

/** CR73: a suggestion is on offer, and its block goes in with the lines as they are. */
export const WithSuggestion: Story = {
    args: { text: 'Bound it.', suggestion: SUGGESTION },
};

/** CR74: a reply says who it answers, and its button is a reply. */
export const Reply: Story = {
    args: {
        target: { id: 'box', path: 'src/sync/engine.ts', side: 'after', line: 50, startLine: null, threadId: 'T_1' },
        replyTo: 'sofiab and claude[bot]',
        text: 'Fine with keeping both. Please add the test before #1203 builds on it.',
    },
};

/** A reply with the draft open can only join it, and says so like any comment. */
export const ReplyDraftOpen: Story = {
    args: { ...Reply.args, draftOpen: true, draftCount: 3 },
};

/** A reply meant to go now met a draft the screen didn't know of: nothing went out, and its keys join now. */
export const ReplyDraftFound: Story = {
    args: { ...Reply.args, draftOpen: true, draftCount: 3, failure: { kind: 'draftFound' } },
};

/** GitHub refused, in its words, and the text stays. */
export const Refused: Story = {
    args: {
        draftOpen: true,
        draftCount: 2,
        failure: { kind: 'refused', message: 'User can only have one pending review per pull request' },
    },
};

/** GitHub didn't answer. */
export const NotReached: Story = { args: { failure: { kind: 'notReached' } } };

/** The draft it was meant for is gone. */
export const NoDraft: Story = { args: { failure: { kind: 'noDraft' } } };
