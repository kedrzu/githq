import type { Meta, StoryObj } from '@storybook/vue3-vite';

import ReviewWrittenComment from './ReviewWrittenComment.vue';

const AUTHOR = { login: 'mlaine', avatarUrl: '' };
const BODY = 'What happens when the same workout is edited twice offline?\nLooks like we push both edits.';
const TARGET = {
    id: 'box',
    path: 'src/sync/engine.ts',
    side: 'after',
    line: 50,
    startLine: null,
    threadId: null,
} as const;

const meta = {
    component: ReviewWrittenComment,
    args: {
        target: TARGET,
        repository: 'mlaine/tasklet',
        itemNumber: 14,
        text: BODY,
        status: { kind: 'editing' },
        draftOpen: false,
        draftCount: 0,
        draftFirst: false,
        focused: false,
        author: AUTHOR,
    },
    render: args => ({
        components: { ReviewWrittenComment },
        setup: () => ({ args }),
        template: `<div style="width: 640px"><ReviewWrittenComment v-bind="args" /></div>`,
    }),
} satisfies Meta<typeof ReviewWrittenComment>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Being written. */
export const Editing: Story = {};

/** A reply, in its thread's band: says who it answers. */
export const Reply: Story = {
    args: { target: { ...TARGET, threadId: 'T1' }, inThread: true, replyTo: 'sofiab', text: '' },
};

/** Sent as a single comment: shown at once, on its way, framed on its own. */
export const Sending: Story = { args: { status: { kind: 'sending', way: 'single', body: BODY } } };

/** `Review / Comment · pending`: gone into the draft. */
export const IntoDraft: Story = { args: { status: { kind: 'sending', way: 'joinDraft', body: BODY } } };

/** GitHub has it, and the threads aren't read yet. */
export const Sent: Story = { args: { status: { kind: 'sent', way: 'single', body: BODY } } };

/** A reply sent: one of its thread's comments, with no frame of its own. */
export const SentInThread: Story = {
    args: {
        target: { ...TARGET, threadId: 'T1' },
        inThread: true,
        status: { kind: 'sent', way: 'single', body: BODY },
    },
};

/** Refused: back to the box with GitHub's words. */
export const Failed: Story = {
    args: { status: { kind: 'failed', failure: { kind: 'refused', message: 'Line could not be resolved' } } },
};
