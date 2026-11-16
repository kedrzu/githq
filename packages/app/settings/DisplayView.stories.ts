import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import DisplayView from './DisplayView.vue';

const meta = {
    component: DisplayView,
    args: {
        animations: true,
        'onUpdate:animations': fn(),
    },
    parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DisplayView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CH49: animations turned on. */
export const AnimationsOn: Story = {};

/** CH49: animations turned off. */
export const AnimationsOff: Story = { args: { animations: false } };

/** A narrow window. */
export const NarrowWindow: Story = {
    decorators: [() => ({ template: '<div style="width: 480px"><story /></div>' })],
};

/** MB158: on a phone, whether things animate alone, a switch row under Motion. */
export const Phone: Story = { args: { phone: true } };
