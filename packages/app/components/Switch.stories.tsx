import type { Meta, StoryObj } from '@storybook/vue3-vite';

import Switch from './Switch.vue';

const meta = {
    component: Switch,
    args: { label: 'Hide whitespace changes', modelValue: false },
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Off: Story = {};

export const On: Story = { args: { modelValue: true } };
