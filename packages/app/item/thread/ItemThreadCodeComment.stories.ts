import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { DB_THREAD, RESOLVED_CODE_COMMENT, REVIEW_VIEWER } from '@/testing/sampleReviews.js';

import ItemThreadCodeComment from './ItemThreadCodeComment.vue';

const meta = {
    component: ItemThreadCodeComment,
    args: {
        entry: RESOLVED_CODE_COMMENT,
        now: SAMPLE_NOW,
        viewer: REVIEW_VIEWER,
        onReply: fn(),
        onSetResolved: fn(),
    },
    render: args => ({
        components: { ItemThreadCodeComment },
        setup: () => ({ args }),
        template: `
          <div style="position: relative; width: 680px; padding: 20px 0; background: #11161c">
            <div style="position: absolute; inset: 0 auto 0 55px; width: 2px; background: #2f353d" />
            <div style="position: relative; padding-left: 28px"><ItemThreadCodeComment v-bind="args" /></div>
          </div>`,
    }),
} satisfies Meta<typeof ItemThreadCodeComment>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Activity / Code comment · resolved`: folded to its row, with the first line of the comment. */
export const Resolved: Story = {};

/** `Activity / Code comment`, open: the thread under the head. */
export const Open: Story = {
    args: { entry: { kind: 'codeComment', id: DB_THREAD.id, thread: { ...DB_THREAD, isOutdated: true } } },
};
