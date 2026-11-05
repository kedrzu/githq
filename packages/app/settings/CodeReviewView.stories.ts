import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import CodeReviewView from './CodeReviewView.vue';

const meta = {
    component: CodeReviewView,
    args: {
        modelValue: 'single',
        'onUpdate:modelValue': fn(),
    },
    parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CodeReviewView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CR77: a comment goes out at once, the default. */
export const SendAtOnce: Story = {};

/** CR77, the other card chosen. */
export const DraftReview: Story = { args: { modelValue: 'draft' } };

/** A narrow window: the text wraps inside the cards. */
export const NarrowWindow: Story = {
    decorators: [() => ({ template: '<div style="width: 360px"><story /></div>' })],
};
