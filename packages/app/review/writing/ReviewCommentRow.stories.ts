import type { Meta, StoryObj } from '@storybook/vue3-vite';

import ReviewCommentRow from './ReviewCommentRow.vue';

const AUTHOR = { login: 'mlaine', avatarUrl: '' };
const BODY = 'What happens when the same workout is edited twice offline?\nLooks like we push both edits.';
const TARGET = { id: 'box', path: 'src/sync/engine.ts', side: 'after', line: 50, startLine: null } as const;

const meta = {
    component: ReviewCommentRow,
    args: {
        row: { kind: 'comment', key: 'comment', target: TARGET, inline: 'unified' },
        text: BODY,
        status: { kind: 'editing' },
        draftOpen: false,
        draftCount: 0,
        draftFirst: false,
        focused: false,
        author: AUTHOR,
    },
} satisfies Meta<typeof ReviewCommentRow>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Being written, in its place. */
export const Editing: Story = {};

/** On the right half in split. */
export const OnRightHalf: Story = {
    args: { row: { kind: 'comment', key: 'comment', target: TARGET, inline: 'right' } },
};

/** Its line isn't shown: the file's width, at its top. */
export const LineNotShown: Story = {
    args: { row: { kind: 'comment', key: 'comment', target: TARGET, inline: null } },
};

/** Sent as a single comment: shown at once, on its way. */
export const Sending: Story = { args: { status: { kind: 'sending', way: 'single', body: BODY } } };

/** `Review / Comment · pending`: gone into the draft. */
export const IntoDraft: Story = { args: { status: { kind: 'sending', way: 'joinDraft', body: BODY } } };

/** GitHub has it, and the threads aren't read yet. */
export const Sent: Story = { args: { status: { kind: 'sent', way: 'single', body: BODY } } };

/** Refused: back to the box with GitHub's words. */
export const Failed: Story = {
    args: { status: { kind: 'failed', failure: { kind: 'refused', message: 'Line could not be resolved' } } },
};
