import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import {
    APPROVED_REVIEW,
    CHANGES_REQUESTED_REVIEW,
    COMMENTED_NO_SUMMARY_REVIEW,
    COMMENTED_REVIEW,
    DISMISSED_REVIEW,
    REVIEW_VIEWER,
} from '@/testing/sampleReviews.js';

import ItemThreadReview from './ItemThreadReview.vue';

/** The main column's content on a full page. */
const ON_PAGE = 680;

const meta = {
    component: ItemThreadReview,
    args: {
        entry: CHANGES_REQUESTED_REVIEW,
        now: SAMPLE_NOW,
        viewer: REVIEW_VIEWER,
        onReply: fn(),
        onSetResolved: fn(),
    },
    // On an item view's background, with the rail behind the gutter.
    render: args => ({
        components: { ItemThreadReview },
        setup: () => ({ args }),
        template: `
          <div style="position: relative; width: ${ON_PAGE}px; padding: 20px 0; background: #11161c">
            <div style="position: absolute; inset: 0 auto 0 55px; width: 2px; background: #2f353d" />
            <div style="position: relative; padding-left: 28px"><ItemThreadReview v-bind="args" /></div>
          </div>`,
    }),
} satisfies Meta<typeof ItemThreadReview>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Activity / Review`: requested changes, a summary, a thread open and one resolved, folded to its row. */
export const ChangesRequested: Story = {};

/** `· approved`: in green, a summary, no threads. */
export const Approved: Story = { args: { entry: APPROVED_REVIEW } };

/** `· commented`: "reviewed", a summary and a thread. */
export const Commented: Story = { args: { entry: COMMENTED_REVIEW } };

/** `· commented, no summary`: the thread alone. */
export const CommentedNoSummary: Story = { args: { entry: COMMENTED_NO_SUMMARY_REVIEW } };

/** `· dismissed`: what it was, folded to its head, "Show review". */
export const Dismissed: Story = { args: { entry: DISMISSED_REVIEW } };

/** Dismissed, its dismissal not read yet: dismissed, not what it was. */
export const DismissedUnknown: Story = { args: { entry: { ...DISMISSED_REVIEW, dismissedFrom: null } } };
