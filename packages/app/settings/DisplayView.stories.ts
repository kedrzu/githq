import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import DisplayView from './DisplayView.vue';

const meta = {
    component: DisplayView,
    args: {
        modelValue: 'tabs',
        'onUpdate:modelValue': fn(),
        animations: true,
        'onUpdate:animations': fn(),
    },
    parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DisplayView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CH43: tabs chosen. */
export const TabsChosen: Story = {};

/** CH43, the other card chosen. */
export const ColumnChosen: Story = { args: { modelValue: 'column' } };

/** CH49: animations turned off. */
export const AnimationsOff: Story = { args: { animations: false } };

/** A narrow window: the cards stay side by side. */
export const NarrowWindow: Story = {
    decorators: [() => ({ template: '<div style="width: 480px"><story /></div>' })],
};
