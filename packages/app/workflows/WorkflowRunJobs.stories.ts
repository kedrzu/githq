import type { GitHubWorkflowJob, GitHubWorkflowStep } from '@githq/github/rest/listRunJobs.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { SAMPLE_WORKFLOWS_NOW } from '@/testing/sampleWorkflows.js';

import type { WorkflowJobCounts } from './buildWorkflowRun.js';
import WorkflowRunJobs from './WorkflowRunJobs.vue';

const MINUTE = 60_000;

const BUILD_STEPS = [
    step(1, 'Set up job', 'success'),
    step(2, 'Checkout', 'success'),
    step(3, 'Run bun run build', 'failure'),
    step(4, 'Upload artifact', 'skipped'),
    step(5, 'Complete job', 'success'),
];

const JOBS = [
    job(103, 'build', 'failure', BUILD_STEPS),
    job(101, 'lint', 'success'),
    job(104, 'typecheck', 'success', [step(1, 'Set up job', 'success')]),
    job(102, 'deploy', 'skipped'),
];

const meta = {
    component: WorkflowRunJobs,
    args: {
        jobs: JOBS,
        counts: countsOf({ failed: 1, skipped: 1, passed: 2 }),
        selectedId: 103,
        loading: false,
        now: SAMPLE_WORKFLOWS_NOW,
        matches: null,
        onSelect: fn(),
    },
    decorators: [() => ({ template: '<div style="display: flex; height: 500px"><story /></div>' })],
} satisfies Meta<typeof WorkflowRunJobs>;

export default meta;

type Story = StoryObj<typeof meta>;

/** W4a: failed first, the failed job selected, its steps shown with the failed one standing out. */
export const Failed: Story = {};

/** W4b: a search's matches on the selected job and, in place of their time, on its steps. */
export const Searching: Story = {
    args: {
        matches: {
            length: 7,
            lines: Array.from({ length: 12 }, (_, index) => index),
            starts: Array.from({ length: 12 }, () => 0),
            lineCount: 12,
            capped: false,
            steps: new Map([
                [2, 2],
                [3, 10],
            ]),
        },
    },
};

/** W4e: placeholder rows while the jobs are on their way. */
export const Loading: Story = {
    args: { jobs: [], counts: countsOf({}), selectedId: null, loading: true },
};

/** No job selected: no steps. */
export const NoneSelected: Story = { args: { selectedId: null } };

/** The selected job has no steps to show. */
export const SelectedWithoutSteps: Story = { args: { selectedId: 101 } };

/** W4j: the running job selected, its running step standing out and counted to now; a job and a step still waiting. */
export const Running: Story = {
    args: {
        jobs: [
            job(105, 'build', null, [
                step(1, 'Set up job', 'success'),
                step(2, 'Run bun run build', null),
                step(3, 'Upload artifact', null, 'queued'),
            ]),
            job(106, 'deploy', null, [], 'waiting'),
            job(101, 'lint', 'success'),
        ],
        counts: countsOf({ running: 1, waiting: 1, passed: 1 }),
        selectedId: 105,
    },
};

/** Every mark a job can have, in the summary too; one with a conclusion that says nothing shows that conclusion. */
export const EveryMark: Story = {
    args: {
        jobs: [
            job(103, 'build', 'failure', BUILD_STEPS),
            job(105, 'test', null),
            job(106, 'deploy', null, [], 'queued'),
            job(102, 'release', 'skipped'),
            job(101, 'lint', 'success'),
            job(107, 'probe', 'cancelled'),
        ],
        counts: countsOf({ failed: 1, running: 1, waiting: 1, skipped: 1, passed: 1, none: 1 }),
    },
};

/** A run with every job passed. */
export const Passed: Story = {
    args: {
        jobs: [job(101, 'lint', 'success', [step(1, 'Set up job', 'success')]), job(104, 'typecheck', 'success')],
        counts: countsOf({ passed: 2 }),
        selectedId: 101,
    },
};

/** The jobs are read and there are none. */
export const NoJobs: Story = { args: { jobs: [], counts: countsOf({}), selectedId: null } };

/** Names wider than the column. */
export const LongNames: Story = {
    args: {
        jobs: [
            job(108, `build (${'ubuntu-latest, node-22, '.repeat(4)}bun)`, 'failure', [
                step(1, `Run ${'bun run build --filter=packages/app '.repeat(4)}`, 'failure'),
            ]),
        ],
        counts: countsOf({ failed: 1 }),
        selectedId: 108,
    },
};

function countsOf(counts: Partial<WorkflowJobCounts>): WorkflowJobCounts {
    return { failed: 0, running: 0, waiting: 0, skipped: 0, passed: 0, none: 0, ...counts };
}

function ago(ms: number) {
    return new Date(SAMPLE_WORKFLOWS_NOW - ms).toISOString();
}

function job(
    id: number,
    name: string,
    conclusion: string | null,
    steps: readonly GitHubWorkflowStep[] = [],
    status = conclusion === null ? 'in_progress' : 'completed',
): GitHubWorkflowJob {
    return {
        id,
        name,
        status,
        conclusion,
        startedAt: status === 'in_progress' || status === 'completed' ? ago(14 * MINUTE) : null,
        completedAt: conclusion === null ? null : ago(12 * MINUTE),
        steps,
    };
}

function step(
    number: number,
    name: string,
    conclusion: string | null,
    status = conclusion === null ? 'in_progress' : 'completed',
): GitHubWorkflowStep {
    const ran = status === 'in_progress' || (status === 'completed' && conclusion !== 'skipped');
    return {
        name,
        number,
        status,
        conclusion,
        startedAt: ran ? ago(14 * MINUTE - number * 10_000) : null,
        completedAt: ran && conclusion !== null ? ago(14 * MINUTE - number * 13_000) : null,
    };
}
