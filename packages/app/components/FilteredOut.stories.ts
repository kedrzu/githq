import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import FilteredOut from './FilteredOut.vue';

const meta = {
    component: FilteredOut,
    args: {
        detail: 'Label is bug hides all 18 open issues.',
        clear: fn(),
    },
    decorators: [() => ({ template: '<div style="display: flex; width: 640px; height: 380px"><story /></div>' })],
} satisfies Meta<typeof FilteredOut>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A screen whose filter hides everything: what it hides, and "Clear filter". */
export const Screen: Story = {};
