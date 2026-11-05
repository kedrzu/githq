import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect } from 'storybook/test';

import ReviewPendingToolbar from './ReviewPendingToolbar.vue';

const meta = {
    component: ReviewPendingToolbar,
    args: { commentCount: 3, hasDraft: true, finish: { kind: 'idle' }, canRetry: false, canDismiss: false },
} satisfies Meta<typeof ReviewPendingToolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CR35, CR36: comments waiting. */
export const Several: Story = {};

/** One comment says so in the singular. */
export const One: Story = { args: { commentCount: 1 } };

/** On its way to GitHub: the ways out wait for the answer. */
export const Sending: Story = {
    args: { finish: { kind: 'sending', finish: { kind: 'submit', choice: { event: 'COMMENT', body: '' } } } },
};

/** A review with no draft on its way: no count, no note and no ways out, only that it goes. */
export const SendingWithoutDraft: Story = {
    args: {
        commentCount: 0,
        hasDraft: false,
        finish: { kind: 'sending', finish: { kind: 'submit', choice: { event: 'APPROVE', body: '' } } },
    },
    play: async ({ canvas }) => {
        await expect(canvas.getByRole('status')).toHaveTextContent('Sending your review…');
        await expect(canvas.queryByRole('button')).toBeNull();
    },
};

/** CR76: GitHub refused, in its words, and everything is kept. No close button: the draft it was sent against is still open. */
export const Refused: Story = {
    args: {
        canRetry: true,
        finish: {
            kind: 'failed',
            finish: { kind: 'submit', choice: { event: 'APPROVE', body: '' } },
            failure: { kind: 'refused', message: 'Can not approve your own pull request' },
            draftId: 'DRAFT',
        },
    },
    play: async ({ canvas }) => {
        await expect(canvas.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
        await expect(canvas.queryByRole('button', { name: 'Dismiss' })).toBeNull();
    },
};

/** A different draft than it was sent against: Try again would submit comments never shown, so only the dialog goes on. */
export const RefusedWithDifferentDraft: Story = {
    args: {
        canDismiss: true,
        finish: {
            kind: 'failed',
            finish: { kind: 'submit', choice: { event: 'APPROVE', body: '' } },
            failure: { kind: 'refused', message: 'Could not comment pull request review.' },
            draftId: 'DRAFT',
        },
    },
    play: async ({ canvas }) => {
        await expect(canvas.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
        await expect(canvas.getByRole('button', { name: 'Edit review…' })).toBeInTheDocument();
        await expect(canvas.queryByRole('button', { name: 'Try again' })).toBeNull();
    },
};

/** A comment queued ahead of it was refused, so the review didn't go. */
export const CommentRefused: Story = {
    args: {
        canRetry: true,
        finish: {
            kind: 'failed',
            finish: { kind: 'submit', choice: { event: 'COMMENT', body: '' } },
            failure: { kind: 'commentRefused' },
            draftId: 'DRAFT',
        },
    },
};

/** GitHub refused with no words of its own, as it has been seen to: the reason is the app's. */
export const RefusedWithoutWords: Story = {
    args: {
        canRetry: true,
        finish: {
            kind: 'failed',
            finish: { kind: 'submit', choice: { event: 'COMMENT', body: '' } },
            failure: { kind: 'refused', message: null },
            draftId: 'DRAFT',
        },
    },
};

/** A review refused with no draft: no comments to count, its failure shows all the same, and nothing holds it there. */
export const RefusedWithoutDraft: Story = {
    args: {
        commentCount: 0,
        hasDraft: false,
        canRetry: true,
        canDismiss: true,
        finish: {
            kind: 'failed',
            finish: { kind: 'submit', choice: { event: 'APPROVE', body: '' } },
            failure: { kind: 'refused', message: 'Review Can not approve your own pull request' },
            draftId: null,
        },
    },
    play: async ({ canvas }) => {
        await expect(canvas.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
        await expect(canvas.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    },
};

/** GitHub didn't answer, which says nothing was refused. */
export const NotReached: Story = {
    args: {
        canRetry: true,
        finish: {
            kind: 'failed',
            finish: { kind: 'submit', choice: { event: 'COMMENT', body: '' } },
            failure: { kind: 'notReached' },
            draftId: 'DRAFT',
        },
    },
};

/** Discarding failed says so, and the draft is still there. */
export const DiscardFailed: Story = {
    args: {
        canRetry: true,
        finish: {
            kind: 'failed',
            finish: { kind: 'discard' },
            failure: { kind: 'refused', message: 'Could not resolve to a node' },
            draftId: 'DRAFT',
        },
    },
};

/** Too narrow for the sentence, it gives way and the button stays. */
export const Narrow: Story = {
    render: args => ({
        components: { ReviewPendingToolbar },
        setup: () => ({ args }),
        template: `<div style="width: 340px"><ReviewPendingToolbar v-bind="args" /></div>`,
    }),
};
