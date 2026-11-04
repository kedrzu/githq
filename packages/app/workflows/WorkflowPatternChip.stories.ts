import type { Meta, StoryObj } from '@storybook/vue3-vite';

import WorkflowPatternChip from './WorkflowPatternChip.vue';

const meta = {
    component: WorkflowPatternChip,
    args: { pattern: 'v*' },
} satisfies Meta<typeof WorkflowPatternChip>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `v*`, as the user typed it: in mono, outlined. */
export const Default: Story = {};

/** A pattern that reaches across slashes. */
export const WithSlashes: Story = { args: { pattern: 'release/**' } };
