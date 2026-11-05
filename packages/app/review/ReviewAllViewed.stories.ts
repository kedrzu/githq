import type { Meta, StoryObj } from '@storybook/vue3-vite';

import ReviewAllViewed from './ReviewAllViewed.vue';

const meta = {
    component: ReviewAllViewed,
    args: { total: 42, threadCount: 6, threadFileCount: 5, nextNumber: 1203 },
} satisfies Meta<typeof ReviewAllViewed>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CR63: threads still open, and a pull request to move on to. */
export const OpenThreads: Story = {};

/** One thread says so in the singular. */
export const OneThread: Story = { args: { threadCount: 1, threadFileCount: 1 } };

/** The end of the list. */
export const NoNext: Story = { args: { nextNumber: null } };

/** Only a file just resolved in, or written on, is left. */
export const NoThreads: Story = { args: { threadCount: 0, threadFileCount: 0 } };

/** The review on its way. */
export const Sending: Story = { args: { sending: true } };
