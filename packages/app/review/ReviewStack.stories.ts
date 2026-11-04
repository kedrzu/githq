import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { GLYPHS_STACK, sampleStackDescription, SYNC_ENGINE_STACK } from '@/testing/sampleStacks.js';

import ReviewStack from './ReviewStack.vue';

const meta = {
    component: ReviewStack,
    render: args => ({
        components: { ReviewStack },
        setup: () => ({ args }),
        template: `<div style="width: 300px"><ReviewStack v-bind="args" /></div>`,
    }),
} satisfies Meta<typeof ReviewStack>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CR47: a stack of two, the second open. */
export const OfTwo: Story = {
    args: { stack: sampleStackDescription(GLYPHS_STACK), currentId: GLYPHS_STACK[1]!.id },
};

/** A long stack: every row, merged ones too; they scroll away with the column. */
export const OfTen: Story = {
    args: { stack: sampleStackDescription(SYNC_ENGINE_STACK), currentId: SYNC_ENGINE_STACK[5]!.id },
};
