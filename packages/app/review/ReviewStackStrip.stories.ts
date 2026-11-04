import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { GLYPHS_STACK, sampleStackDescription, SYNC_ENGINE_STACK } from '@/testing/sampleStacks.js';

import ReviewStackStrip from './ReviewStackStrip.vue';

const meta = {
    component: ReviewStackStrip,
    render: args => ({
        components: { ReviewStackStrip },
        setup: () => ({ args }),
        template: `<div style="width: 300px; height: 40px"><ReviewStackStrip v-bind="args" /></div>`,
    }),
} satisfies Meta<typeof ReviewStackStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CR48: a stack of two, the open one outlined with its mark. */
export const OfTwo: Story = {
    args: { stack: sampleStackDescription(GLYPHS_STACK), currentId: GLYPHS_STACK[1]!.id },
};

/** A stack of ten: the name gets short, and past what fits the squares scroll sideways. */
export const OfTen: Story = {
    args: { stack: sampleStackDescription(SYNC_ENGINE_STACK), currentId: SYNC_ENGINE_STACK[5]!.id },
};

/** A place the copy doesn't hold yet: a hollow square going nowhere (stacked PRs D7). */
export const WithMissingPlace: Story = {
    args: {
        stack: {
            ...sampleStackDescription(GLYPHS_STACK),
            size: GLYPHS_STACK.length + 1,
            pips: [{ kind: 'missing', position: 1 }, ...sampleStackDescription(GLYPHS_STACK).pips],
        },
        currentId: GLYPHS_STACK[0]!.id,
    },
};

const WITH_DRAFT = GLYPHS_STACK.map(pr => ({
    ...pr,
    pendingReview: { id: 'PRR_1', commentCount: 3, createdAt: '2026-11-01T10:00:00Z' },
}));

/** `Stack bar / Place · soft, draft` and `· soft, current, draft`: an amber dot on the square's corner, the last one's fitting too. */
export const WithDrafts: Story = {
    args: { stack: sampleStackDescription(WITH_DRAFT), currentId: WITH_DRAFT[1]!.id },
};
