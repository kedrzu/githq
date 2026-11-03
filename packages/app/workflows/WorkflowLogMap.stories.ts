import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import WorkflowLogMap from './WorkflowLogMap.vue';

const meta = {
    component: WorkflowLogMap,
    args: {
        total: 4000,
        viewTop: 1200,
        viewHeight: 400,
        steps: [0, 26, 52, 1100, 2600, 2626],
        errors: [1180, 1500, 2580],
        cursor: 1500,
        onMove: fn(),
    },
    decorators: [() => ({ template: '<div style="display: flex; height: 400px"><story /></div>' })],
} satisfies Meta<typeof WorkflowLogMap>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Steps, errors, the view and the cursor, all at once. */
export const Default: Story = {};

/** No line under the cursor. */
export const NoCursor: Story = { args: { cursor: null } };

/** A log with no errors: steps and the view only. */
export const NoErrors: Story = { args: { errors: [] } };

/** Thousands of errors: those falling on the same marks draw one. */
export const ManyErrors: Story = {
    args: { errors: Array.from({ length: 5000 }, (_, index) => index * 0.8) },
};

/** A log shorter than the view takes its own height, not the map's whole. */
export const ShorterThanView: Story = {
    args: { total: 200, viewTop: 0, steps: [0, 26, 52], errors: [150], cursor: 150 },
};
