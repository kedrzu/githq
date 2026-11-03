import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { sampleMergeCheck } from '@/testing/sampleMergeChecks.js';

import MergeCheckRow from './MergeCheckRow.vue';

const meta = {
    component: MergeCheckRow,
    args: {
        check: sampleMergeCheck('ci / test (node 20)', { isRequired: true }),
        now: Date.UTC(2026, 10, 2, 12, 0, 0),
    },
    // A row of the merge panel's list.
    render: args => ({
        components: { MergeCheckRow },
        setup: () => ({ args }),
        template:
            '<ul style="width: 640px; margin: 0; padding: 0; list-style: none; background: #16181c"><MergeCheckRow v-bind="args" /></ul>',
    }),
} satisfies Meta<typeof MergeCheckRow>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A required check that passed. */
export const Passed: Story = {};

/** A required check that failed, where no heading says it is required: tagged, on grey. */
export const RequiredFailed: Story = {
    args: {
        check: sampleMergeCheck('ci / test (node 20)', { isRequired: true, state: 'failing' }),
        tagged: true,
    },
};

/** Failed outside GitHub Actions: githq can't re-run it, so its link says where. */
export const FailedOutsideActions: Story = {
    args: {
        check: sampleMergeCheck('Vercel / preview', {
            state: 'failing',
            workflowRunId: null,
            url: 'https://vercel.com/acme/web/deployments/1',
        }),
    },
};

/** One that isn't required, still running: grey, and it doesn't stop the merge. */
export const OptionalRunning: Story = {
    args: {
        check: sampleMergeCheck('Vercel / preview', {
            state: 'pending',
            startedAt: '2026-11-02T11:58:55Z',
            completedAt: null,
        }),
    },
};
