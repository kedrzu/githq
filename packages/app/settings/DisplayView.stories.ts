import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import DisplayView from './DisplayView.vue';

const meta = {
    component: DisplayView,
    args: {
        login: 'mlaine',
        saving: 'on',
        modelValue: 'tabs',
        'onUpdate:modelValue': fn(),
    },
    parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DisplayView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CH43: tabs chosen, saved with the settings. */
export const TabsChosen: Story = {};

/** CH43, the other card chosen. */
export const ColumnChosen: Story = { args: { modelValue: 'column' } };

/** Saving is off: the choice stays on this device. */
export const SavingOff: Story = { args: { saving: 'off' } };

/** Syncing stopped: the choice stays on this device until it is fixed. */
export const SyncStopped: Story = { args: { saving: 'stopped', modelValue: 'column' } };

/** A narrow window: the cards stay side by side. */
export const NarrowWindow: Story = {
    decorators: [() => ({ template: '<div style="width: 480px"><story /></div>' })],
};
