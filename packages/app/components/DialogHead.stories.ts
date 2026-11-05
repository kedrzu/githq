import type { Meta, StoryObj } from '@storybook/vue3-vite';

import DialogHead from './DialogHead.vue';

const meta = {
    component: DialogHead,
    args: { title: 'Keyboard shortcuts' },
} satisfies Meta<typeof DialogHead>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The title, and Esc at the far end. */
export const Default: Story = {};
