import type { Meta, StoryObj } from '@storybook/vue3-vite';

import ReviewPendingPill from './ReviewPendingPill.vue';

const meta = {
    component: ReviewPendingPill,
} satisfies Meta<typeof ReviewPendingPill>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Review / Comment · pending`. */
export const Default: Story = {};
