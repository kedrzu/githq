import type { GitHubWorkflowJob, GitHubWorkflowStep } from '@githq/github/rest/listRunJobs.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { SAMPLE_WORKFLOWS_NOW } from '@/testing/sampleWorkflows.js';

import { parseJobLog } from './utils/parseJobLog.js';
import WorkflowRunLogPane from './WorkflowRunLogPane.vue';

const MINUTE = 60_000;
const STEP_MS = 10_000;
const DAY = 24 * 60 * MINUTE;

const BUILD_STEPS = [
    step(1, 'Set up job', 'success'),
    step(2, 'Run bun run build', 'failure'),
    step(3, 'Complete job', 'success'),
];

const BUILD_JOB = job(103, 'build', 'failure', BUILD_STEPS);

const LOG_TEXT = [
    `${stepStart(1)} Runner image`,
    `${stepStart(2)} ##[group]Run bun run build`,
    `${stepStart(2)} building the bundle`,
    `${stepStart(2)} ##[error]Process completed with exit code 1.`,
    `${stepStart(3)} Bye`,
].join('\n');

const meta = {
    component: WorkflowRunLogPane,
    args: {
        pane: { kind: 'ready', job: BUILD_JOB, log: parseJobLog(LOG_TEXT, BUILD_STEPS) },
        nameWithOwner: 'fitloop/webapp',
        runId: 4821,
        lineAddress: null,
        runCreatedAt: ago(14 * MINUTE),
        now: SAMPLE_WORKFLOWS_NOW,
        onOpenOnGitHub: fn(),
        onRetry: fn(),
    },
    decorators: [() => ({ template: '<div style="display: flex; height: 500px; width: 900px"><story /></div>' })],
} satisfies Meta<typeof WorkflowRunLogPane>;

export default meta;

type Story = StoryObj<typeof meta>;

/** W4a: the job's log, with the keys it answers to along the bottom. */
export const Ready: Story = {};

/** W4e: no job known yet: placeholder lines. */
export const LoadingNoJob: Story = { args: { pane: { kind: 'loading', job: null } } };

/** W4e: the job known, its log on the way. */
export const Loading: Story = { args: { pane: { kind: 'loading', job: BUILD_JOB } } };

/** W4j: the job still running: its log lands here by itself. */
export const Running: Story = {
    args: { pane: { kind: 'running', job: job(105, 'build', null) } },
};

/** W4j: the job has not started. */
export const Waiting: Story = {
    args: { pane: { kind: 'running', job: job(106, 'deploy', null, [], 'waiting') } },
};

/** It never ran, so it has no log. */
export const Skipped: Story = {
    args: { pane: { kind: 'skipped', job: job(102, 'deploy', 'skipped') } },
};

/** W4g: past retention, with the failed step named. */
export const GonePastRetention: Story = {
    args: { pane: { kind: 'gone', job: BUILD_JOB }, runCreatedAt: ago(98 * DAY) },
};

/** Deleted before the retention is up: a repository can set a shorter one, and no step failed to name. */
export const GoneYoung: Story = {
    args: { pane: { kind: 'gone', job: job(101, 'lint', 'success') } },
};

/** W4i: the read failed, with GitHub's real answer; Enter tries again. */
export const Failed: Story = {
    args: { pane: { kind: 'failed', job: BUILD_JOB, httpStatus: 502 } },
};

/** W4i with no answer at all. */
export const FailedNoAnswer: Story = {
    args: { pane: { kind: 'failed', job: BUILD_JOB, httpStatus: null } },
};

/** When step `number` started: they run one after the other, so a log's lines tell which they belong to. */
function stepStart(number: number) {
    return ago(14 * MINUTE - number * STEP_MS);
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
        startedAt: status === 'waiting' ? null : ago(14 * MINUTE),
        completedAt: conclusion === null ? null : ago(12 * MINUTE),
        steps,
    };
}

function step(number: number, name: string, conclusion: string): GitHubWorkflowStep {
    return {
        name,
        number,
        status: 'completed',
        conclusion,
        startedAt: stepStart(number),
        completedAt: ago(14 * MINUTE - number * STEP_MS - 3000),
    };
}
