import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { REVIEW_VIEWER } from '@/testing/sampleReviews.js';

import ReviewThreadBands from './ReviewThreadBands.vue';

const meta = {
    component: ReviewThreadBands,
    args: {
        viewer: REVIEW_VIEWER,
        canReply: true,
        canToggle: true,
        resolved: false,
        onReply: fn(),
        onSetResolved: fn(),
    },
    render: args => ({
        components: { ReviewThreadBands },
        setup: () => ({ args }),
        template: `
          <div style="width: 584px; overflow: hidden; background: #0d1117; border: 1px solid #3d444d; border-radius: 8px">
            <ReviewThreadBands v-bind="args" />
          </div>`,
    }),
} satisfies Meta<typeof ReviewThreadBands>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Thread / Reply band` and `Thread / Resolve band`. */
export const Open: Story = {};

/** `Thread / Reply band · focused`: Reply… shows its key. */
export const Focused: Story = { args: { replyKey: 'R' } };

/** In a thread holding a pending comment: where the reply goes. */
export const AddToDraft: Story = { args: { replyLabel: 'Add to your draft…' } };

/** Resolved: Unresolve and who resolved it. */
export const Resolved: Story = { args: { resolved: true, resolver: 'mlaine' } };

/** GitHub lets the viewer neither reply nor resolve: no band. */
export const NothingAllowed: Story = { args: { canReply: false, canToggle: false } };
