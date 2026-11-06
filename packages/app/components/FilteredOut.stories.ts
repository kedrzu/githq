import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import FilteredOut from './FilteredOut.vue';

const meta = {
    component: FilteredOut,
    args: {
        place: 'screen',
        filter: 'label:bug',
        detail: 'Label is bug hides all 18 open issues.',
        clear: fn(),
    },
    decorators: [() => ({ template: '<div style="display: flex; width: 640px; height: 380px"><story /></div>' })],
} satisfies Meta<typeof FilteredOut>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A screen whose filter hides everything: what it hides, and "Clear filter". */
export const Screen: Story = {};

/** A group the filter leaves empty: one line naming it, and a small "Clear filter". */
export const Group: Story = {
    args: { place: 'group' },
    decorators: [() => ({ template: '<div style="width: 644px"><story /></div>' })],
};

/** A board column the filter leaves empty. */
export const Column: Story = {
    args: { place: 'column' },
    decorators: [() => ({ template: '<div style="width: 252px"><story /></div>' })],
};
