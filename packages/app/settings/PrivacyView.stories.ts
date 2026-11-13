import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import PrivacyView from './PrivacyView.vue';

const meta = {
    component: PrivacyView,
    args: {
        modelValue: true,
        'onUpdate:modelValue': fn(),
    },
    parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PrivacyView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** T23: usage statistics shared, the default. */
export const Sharing: Story = {};

/** T23, usage statistics turned off. */
export const NotSharing: Story = { args: { modelValue: false } };

/** A narrow window: the text wraps beside the switch. */
export const NarrowWindow: Story = {
    decorators: [() => ({ template: '<div style="width: 360px"><story /></div>' })],
};
