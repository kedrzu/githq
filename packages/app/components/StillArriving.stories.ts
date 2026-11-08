import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { withMotion } from '@/testing/withMotion.js';

import StillArriving from './StillArriving.vue';

const meta = {
    component: StillArriving,
    args: { place: 'screen' },
    decorators: [withMotion, () => ({ template: '<div style="width: 644px"><story /></div>' })],
} satisfies Meta<typeof StillArriving>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A list with nothing in it yet: a dozen ghost rows fading from full strength to a quarter. */
export const Screen: Story = {};

/** A list's group on its way: three rows. */
export const Group: Story = { args: { place: 'group' } };

/** A board's column on its way: three ghost cards. */
export const Column: Story = {
    args: { place: 'column' },
    decorators: [() => ({ template: '<div style="width: 252px; padding: 16px"><story /></div>' })],
};

/** A board whose columns aren't known yet: four ghost columns (first run and loading D17, ES29). */
export const Board: Story = {
    args: { place: 'board' },
    decorators: [() => ({ template: '<div style="width: 1200px; padding: 12px 16px"><story /></div>' })],
};
