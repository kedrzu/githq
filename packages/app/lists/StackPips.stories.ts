import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect } from 'storybook/test';

import { SAMPLE_STACKS, sampleListStack, sampleStack } from '@/testing/sampleStacks.js';

import StackPips from './StackPips.vue';

const HELD = SAMPLE_STACKS.held;

const meta = {
    component: StackPips,
    args: { pips: sampleListStack(HELD).description.pips },
} satisfies Meta<typeof StackPips>;

export default meta;

type Story = StoryObj<typeof meta>;

/** SP14's "Held": one pip per pull request, first to last, each in its own state. */
export const WholeStack: Story = {
    play: async ({ canvasElement }) => {
        await expect(getPips(canvasElement)).toHaveLength(4);
    },
};

/** SP24: a share of the stack — its own two drawn in their state, the stack's other open ones hollow. */
export const Share: Story = { args: { filled: new Set(HELD.slice(0, 2).map(pr => pr.id)) } };

/** SP13: on a lone row's marker, the row's own pull request tall, the others hollow. */
export const Current: Story = {
    args: { filled: new Set([HELD[2]?.id ?? '']), current: HELD[2]?.id ?? null },
};

/** D7: the copy holds two of the stack's four pull requests so far — the missing ones hollow. */
export const Incomplete: Story = {
    args: { pips: sampleListStack(SAMPLE_STACKS.incomplete).description.pips },
    play: async ({ canvasElement }) => {
        await expect(getPips(canvasElement)).toHaveLength(4);
    },
};

/** D14: beyond 12 pull requests the pips narrow. */
export const Narrow: Story = {
    args: {
        pips: sampleListStack(
            sampleStack({ id: 'S_long', number: 100, members: Array.from({ length: 14 }, () => ({})) }),
        ).description.pips,
    },
    play: async ({ canvasElement }) => {
        await expect(getPips(canvasElement)).toHaveLength(14);
    },
};

/** The pips drawn: the children of the decoration. */
function getPips(canvasElement: HTMLElement) {
    return [...(canvasElement.querySelector('[aria-hidden="true"]')?.children ?? [])];
}
