import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import DiffCommentButton from './DiffCommentButton.vue';

const meta = {
    component: DiffCommentButton,
    args: { line: 51, onGutter: fn() },
    render: args => ({
        components: { DiffCommentButton },
        setup: () => ({ args }),
        template: `<div style="display: flex; padding: 24px"><DiffCommentButton v-bind="args" /></div>`,
    }),
} satisfies Meta<typeof DiffCommentButton>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Diff / Comment button` (D43): an accent square with a `+`, its tooltip on hover naming the line and C. */
export const Default: Story = {};
