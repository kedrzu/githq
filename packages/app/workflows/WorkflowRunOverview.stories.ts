import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { SAMPLE_PASSED_JOBS, SAMPLE_PASSED_RUN, sampleRunJob } from '@/testing/samplePassedRun.js';
import { SAMPLE_WORKFLOWS_NOW } from '@/testing/sampleWorkflows.js';

import WorkflowRunOverview from './WorkflowRunOverview.vue';

const NO_JOBS = { failed: 0, running: 0, waiting: 0, skipped: 0, passed: 0, none: 0 };

const meta = {
    component: WorkflowRunOverview,
    args: {
        run: SAMPLE_PASSED_RUN,
        jobs: SAMPLE_PASSED_JOBS,
        counts: { ...NO_JOBS, passed: 7 },
        now: SAMPLE_WORKFLOWS_NOW,
    },
} satisfies Meta<typeof WorkflowRunOverview>;

export default meta;

type Story = StoryObj<typeof meta>;

/** W34: a run that passed, its jobs over time, who started it, its commit and attempt. */
export const Passed: Story = {};

/** Still going: running for how long, a running job's bar to now, a waiting one with none. */
export const Running: Story = {
    args: {
        run: { ...SAMPLE_PASSED_RUN, status: 'in_progress', conclusion: null, runAttempt: 2 },
        jobs: [
            sampleRunJob(201, 'build', 0, 144, 'success'),
            sampleRunJob(205, 'test (node 20)', 10, null, null),
            sampleRunJob(202, 'deploy', null, null, null),
        ],
        counts: { ...NO_JOBS, passed: 1, running: 1, waiting: 1 },
    },
};

/** Cancelled with nothing failed. */
export const Cancelled: Story = {
    args: {
        run: { ...SAMPLE_PASSED_RUN, conclusion: 'cancelled' },
        jobs: [sampleRunJob(201, 'build', 0, 144, 'success'), sampleRunJob(202, 'deploy', 150, 160, 'cancelled')],
        counts: { ...NO_JOBS, passed: 1, none: 1 },
    },
};

/** The jobs known before the run itself is read: no headline, nothing about the run yet. */
export const OnlyJobsKnown: Story = { args: { run: null } };
