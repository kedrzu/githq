import type { Meta, StoryObj } from '@storybook/vue3-vite';

import ReviewPendingList from './ReviewPendingList.vue';

const meta = {
    component: ReviewPendingList,
    args: {
        comments: [
            { id: '1', where: 'engine.ts:48', excerpt: 'If ack throws after a partial send, the next flush…' },
            { id: '2', where: 'queue.ts:61', excerpt: 'MAX_ATTEMPTS = 8 reads arbitrary. Where does 8…' },
        ],
    },
} satisfies Meta<typeof ReviewPendingList>;

export default meta;

type Story = StoryObj<typeof meta>;

/** One line each: where it is and how it starts. */
export const Default: Story = {};

/** A long excerpt gives way, and where it is stays. */
export const Narrow: Story = {
    render: args => ({
        components: { ReviewPendingList },
        setup: () => ({ args }),
        template: `<div style="width: 280px"><ReviewPendingList v-bind="args" /></div>`,
    }),
};
