import type { Meta, StoryObj } from '@storybook/vue3-vite';

import ReviewDiscardDialog from './ReviewDiscardDialog.vue';

const meta = {
    component: ReviewDiscardDialog,
    args: {
        open: true,
        number: 1202,
        commentCount: 3,
        comments: [
            { id: '1', where: 'engine.ts:48', excerpt: 'If ack throws after a partial send, the next flush…' },
            { id: '2', where: 'engine.ts:50', excerpt: 'scheduleRetry needs a ceiling, or a dead token…' },
            { id: '3', where: 'queue.ts:61', excerpt: 'MAX_ATTEMPTS = 8 reads arbitrary. Where does 8…' },
        ],
    },
} satisfies Meta<typeof ReviewDiscardDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CR39: asks first, focus on Cancel. */
export const Several: Story = {};

/** One comment says so in the singular. */
export const One: Story = {
    args: { commentCount: 1, comments: [{ id: '1', where: 'engine.ts:48', excerpt: 'Why?' }] },
};
