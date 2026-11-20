import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { REVIEW_VIEWER } from '@/testing/sampleReviews.js';
import { sampleThread } from '@/testing/sampleThreads.js';
import { useSampleReviewCommentActions } from '@/testing/useSampleReviewCommentActions.js';

import ReviewThreadBox from './ReviewThreadBox.vue';

/** As wide as a thread under its line in split. */
const WIDTH = 584;

const meta = {
    component: ReviewThreadBox,
    args: {
        thread: sampleThread(),
        outdatedNote: null,
        viewer: REVIEW_VIEWER,
        onToggle: fn(),
        onReply: fn(),
        onSetResolved: fn(),
    },
    // On the diff's page colour, with the view's comment actions (`parameters.menu`).
    render: (args, { parameters }) => ({
        components: { ReviewThreadBox },
        setup: () => ({ args, commentActions: parameters.menu ? useSampleReviewCommentActions() : null }),
        template: `
          <div style="width: ${WIDTH}px; padding: 12px; background: #0d1117">
            <ReviewThreadBox v-bind="args" :comment-actions="commentActions" />
          </div>`,
    }),
} satisfies Meta<typeof ReviewThreadBox>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Review / Thread`: the comments in its body, then the Reply band and the Resolve band. */
export const Open: Story = {};

/** `· focused`: the accent edge, and Reply… shows its key. */
export const Focused: Story = { args: { focused: true } };

/** `· outdated`: the head band says how it was placed. */
export const Outdated: Story = {
    args: {
        thread: sampleThread({ isOutdated: true }),
        outdatedNote: 'placed by finding its line again, so the place is approximate',
    },
};

/** The viewer's own comment, with the view's actions: each comment has its ⋯. */
export const WithMenu: Story = {
    args: {
        thread: sampleThread({
            comments: sampleThread().comments.map(comment => ({
                ...comment,
                author: REVIEW_VIEWER,
                lastEditedAt: '2026-10-30T14:00:00Z',
                viewerCanUpdate: true,
                viewerCanDelete: true,
            })),
        }),
    },
    parameters: { menu: true },
};

/** `· resolved`: one line. */
export const Resolved: Story = { args: { thread: sampleThread({ isResolved: true }) } };

/** Resolved and opened: the line, then the comments and Unresolve. */
export const ResolvedOpen: Story = { args: { thread: sampleThread({ isResolved: true }), open: true } };

/** A comment's deletion GitHub didn't take: it shows again, and the Resolve band says why. */
export const DeleteRefused: Story = { args: { deleteFailure: { kind: 'notReached' } } };
