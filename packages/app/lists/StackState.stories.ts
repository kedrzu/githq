import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { CircleX } from 'lucide-vue-next';
import { expect, within } from 'storybook/test';

import { SAMPLE_STACKS, sampleListStack } from '@/testing/sampleStacks.js';

import StackState from './StackState.vue';

const HELD = sampleListStack(SAMPLE_STACKS.held);

const meta = {
    component: StackState,
    args: {
        pips: HELD.description.pips,
        state: { icon: CircleX, tone: 'danger', text: '2 of 4 ready, #1206 blocks' },
    },
} satisfies Meta<typeof StackState>;

export default meta;

type Story = StoryObj<typeof meta>;

/** SP14 "Held" as a stack's row shows it. */
export const Row: Story = {
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText('2 of 4 ready, #1206 blocks')).toBeVisible();
    },
};

/** On a board's card: the smaller icon, the sentence clipped to the card. */
export const Compact: Story = { args: { compact: true } };
