import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, within } from 'storybook/test';

import { samplePullRequest } from '@/testing/sampleItems.js';
import { SAMPLE_STACKS, sampleListStack } from '@/testing/sampleStacks.js';

import StackMarker from './StackMarker.vue';

const WAITLIST = sampleListStack(SAMPLE_STACKS.waitingForReview);

const meta = {
    component: StackMarker,
    args: {
        item: SAMPLE_STACKS.waitingForReview[2],
        stack: WAITLIST.description,
    },
} satisfies Meta<typeof StackMarker>;

export default meta;

type Story = StoryObj<typeof meta>;

/** SP13: the third of three, listed alone — its pip tall, the others hollow, and its place. */
export const LastOfThree: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByLabelText('In a stack')).toBeInTheDocument();
        await expect(canvas.getByText('3 of 3')).toBeVisible();
    },
};

/** A pull request of no stack: nothing. */
export const NotStacked: Story = {
    args: { item: samplePullRequest('PR_plain'), stack: null },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).queryByLabelText('In a stack')).toBeNull();
    },
};
