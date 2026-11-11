import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { getPendingComments } from '@/review/writing/getPendingComments.js';
import { idleReviewWriting } from '@/testing/idleReviewWriting.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { DRAFT_THREAD, PENDING_REVIEW, REVIEW_VIEWER } from '@/testing/sampleReviews.js';

import ItemThreadPendingReview from './ItemThreadPendingReview.vue';

const meta = {
    component: ItemThreadPendingReview,
    args: {
        entry: PENDING_REVIEW,
        now: SAMPLE_NOW,
        viewer: REVIEW_VIEWER,
        number: 15,
        writing: { ...idleReviewWriting, draftOpen: true, draftCount: 1, submit: fn(), discard: fn() },
        comments: getPendingComments([DRAFT_THREAD]),
    },
    render: args => ({
        components: { ItemThreadPendingReview },
        setup: () => ({ args }),
        template: `
          <div style="position: relative; width: 680px; padding: 20px 0; background: #11161c">
            <div style="position: absolute; inset: 0 auto 0 55px; width: 2px; background: #2f353d" />
            <div style="position: relative; padding-left: 28px"><ItemThreadPendingReview v-bind="args" /></div>
          </div>`,
    }),
} satisfies Meta<typeof ItemThreadPendingReview>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Activity / Review · pending`: amber, its comment "Pending", the pending toolbar at its foot. */
export const Pending: Story = {};

/** Submitting it was refused: the toolbar turns red with why, Edit review… and Try again. */
export const SubmitRefused: Story = {
    args: {
        writing: {
            ...idleReviewWriting,
            draftOpen: true,
            draftCount: 1,
            canRetry: true,
            finish: {
                kind: 'failed',
                finish: { kind: 'submit', choice: { event: 'APPROVE', body: '' } },
                failure: { kind: 'refused', message: 'Can not approve your own pull request' },
                draftId: 'R_draft',
            },
        },
    },
};
