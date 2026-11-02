import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, within } from 'storybook/test';

import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_STACKS, sampleListStack } from '@/testing/sampleStacks.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import ItemCard from './ItemCard.vue';
import { ITEM_PROPERTIES } from './ItemProperty.js';

const [LONE] = SAMPLE_STACKS.needsRebase;
if (!LONE) {
    throw new Error('The sample stack needs pull requests.');
}

const meta = {
    component: ItemCard,
    args: {
        item: LONE,
        properties: ITEM_PROPERTIES,
        now: SAMPLE_NOW,
        viewerLogin: SAMPLE_VIEWER.login,
        people: 'assignees',
    },
    // As wide as a board's column, in a card as the board draws it.
    render: args => ({
        components: { ItemCard },
        setup: () => ({ args }),
        template: `<div style="width: 268px; background: #1a1d22; border: 1px solid #22262d; border-radius: 8px">
            <ItemCard v-bind="args" />
        </div>`,
    }),
} satisfies Meta<typeof ItemCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/** SP27's second card, SP26's mobile#94: a pull request alone in its column, an ordinary card with the marker "1 of 3". */
export const LoneCard: Story = {
    args: { stack: sampleListStack(SAMPLE_STACKS.needsRebase).description },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByLabelText('In a stack')).toBeVisible();
        await expect(canvas.getByText('1 of 3')).toBeVisible();
    },
};
