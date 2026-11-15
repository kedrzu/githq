import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import PhoneSettingsSwitchRow from './PhoneSettingsSwitchRow.vue';

const meta = {
    component: PhoneSettingsSwitchRow,
    args: {
        label: 'Animations',
        description: "Short fades and slides show where a sheet or panel comes from, so the screen doesn't jump.",
        modelValue: true,
        'onUpdate:modelValue': fn(),
    },
    render: args => ({
        components: { PhoneSettingsSwitchRow },
        setup: () => ({ args }),
        template: '<div style="width: 390px"><PhoneSettingsSwitchRow v-bind="args" /></div>',
    }),
} satisfies Meta<typeof PhoneSettingsSwitchRow>;

export default meta;

type Story = StoryObj<typeof meta>;

/** MB158: on. */
export const On: Story = {};

/** Off. */
export const Off: Story = { args: { modelValue: false } };

/** A label alone. */
export const LabelOnly: Story = { args: { description: undefined } };
