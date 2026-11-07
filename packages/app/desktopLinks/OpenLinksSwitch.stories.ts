import type { Meta, StoryObj } from '@storybook/vue3-vite';

import OpenLinksSwitch from './OpenLinksSwitch.vue';

const meta = {
    component: OpenLinksSwitch,
    args: { modelValue: false },
} satisfies Meta<typeof OpenLinksSwitch>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Off until the user opts in. */
export const Off: Story = {};

export const On: Story = { args: { modelValue: true } };
