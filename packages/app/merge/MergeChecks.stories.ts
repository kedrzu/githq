import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { SAMPLE_PASSED_CHECKS } from '@/testing/sampleMergeChecks.js';

import MergeChecks from './MergeChecks.vue';
import type { MergeCheck } from './MergeTypes.js';

/** When the stories happen: a running check's time is counted to it. */
const NOW = Date.UTC(2026, 10, 2, 12, 0, 0);

/** A required check failed, and one that isn't required. */
const REQUIRED_FAILED = withStates({
    'test (node 20)': { state: 'failing' },
    preview: { state: 'failing', completedAt: '2026-11-02T11:55:48Z' },
});

const meta = {
    component: MergeChecks,
    args: {
        checks: SAMPLE_PASSED_CHECKS,
        summary: { state: 'SUCCESS', passing: 9, failing: 0, pending: 0 },
        open: false,
        now: NOW,
        onToggle: fn(),
    },
    // As wide as the merge panel.
    render: args => ({
        components: { MergeChecks },
        setup: () => ({ args }),
        template: '<div style="width: 640px; background: #151b23"><MergeChecks v-bind="args" /></div>',
    }),
} satisfies Meta<typeof MergeChecks>;

export default meta;

type Story = StoryObj<typeof meta>;

/** PM4a: all passed — one green line, "5 required" aside, the list to open. */
export const FoldedPassed: Story = {};

/** PM4a: a required check failed — it shows tagged and first; the one that isn't required says it doesn't stop the merge. */
export const FoldedRequiredFailed: Story = {
    args: { checks: REQUIRED_FAILED, summary: { state: 'FAILURE', passing: 7, failing: 2, pending: 0 } },
};

/** PM4a: required checks still running — amber, how long each has run. */
export const FoldedRunning: Story = {
    args: {
        checks: withStates({
            'test (node 20)': { state: 'pending', startedAt: '2026-11-02T11:56:48Z', completedAt: null },
            'e2e (chromium)': { state: 'pending', startedAt: null, completedAt: null },
            preview: { state: 'pending', startedAt: '2026-11-02T11:58:55Z', completedAt: null },
        }),
        summary: { state: 'PENDING', passing: 6, failing: 0, pending: 3 },
    },
};

/** PM4a: the full list open — Required, then Others, each with its state, time and log. */
export const Open: Story = { args: { ...FoldedRequiredFailed.args, open: true } };

/** Before the panel's read: the row's summary alone, with nothing to open. */
export const BeforeRead: Story = { args: { checks: null } };

/** The sample checks, the ones named changed. */
function withStates(changes: Readonly<Record<string, Partial<MergeCheck>>>): MergeCheck[] {
    return SAMPLE_PASSED_CHECKS.map(check => ({ ...check, ...changes[check.name] }));
}
