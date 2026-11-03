import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import WorkflowLogMap from './WorkflowLogMap.vue';

const meta = {
    component: WorkflowLogMap,
    args: {
        total: 2086,
        viewTop: 600,
        viewHeight: 28,
        height: 400,
        steps: [36, 70, 92, 590, 2060, 2075],
        errors: [596, 620, 2050],
        cursor: 620,
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
    args: { errors: Array.from({ length: 2000 }, (_, index) => index) },
};

/** W4b: a search's matches, above the steps and under the errors. */
export const Matches: Story = {
    args: { matches: [100, 150, 604, 606, 612, 640, 700, 1100, 2040] },
};

/** Tens of thousands of matches: those falling on the same pixels draw one. */
export const ManyMatches: Story = {
    args: { matches: Array.from({ length: 50_000 }, (_, index) => (index * 2086) / 50_000) },
};

/** A log shorter than the view takes the lines' own height, not the map's whole: `total` counts the view's lines. */
export const ShorterThanView: Story = {
    args: { total: 28, viewTop: 0, viewHeight: 8, steps: [2, 5], errors: [6], cursor: 6 },
};
