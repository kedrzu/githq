import type { Meta, StoryObj } from '@storybook/vue3-vite';

import RequiredTag from './RequiredTag.vue';

const meta = {
    component: RequiredTag,
} satisfies Meta<typeof RequiredTag>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The tag, as it sits beside a check's name. */
export const Default: Story = {};
