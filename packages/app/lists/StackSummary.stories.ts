import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, within } from 'storybook/test';

import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_STACKS, sampleListStack } from '@/testing/sampleStacks.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import StackSummary from './StackSummary.vue';

const meta = {
    component: StackSummary,
    args: {
        stack: sampleListStack(SAMPLE_STACKS.held),
        now: SAMPLE_NOW,
        viewerLogin: SAMPLE_VIEWER.login,
    },
} satisfies Meta<typeof StackSummary>;

export default meta;

type Story = StoryObj<typeof meta>;

/** SP21: on an issue serving as the stack's header, the pips and what holds the stack. */
export const Held: Story = {
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText('2 of 4 ready, #1206 blocks')).toBeVisible();
    },
};

/** Every open pull request of the stack can merge. */
export const Ready: Story = {
    args: { stack: sampleListStack(SAMPLE_STACKS.ready) },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText('All 3 ready')).toBeVisible();
    },
};
