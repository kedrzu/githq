import type { GitHubWorkflowRunDetail } from '@githq/github/rest/getWorkflowRun.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { SAMPLE_WORKFLOWS_NOW } from '@/testing/sampleWorkflows.js';

import WorkflowRunSummary from './WorkflowRunSummary.vue';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const RUN: GitHubWorkflowRunDetail = {
    id: 4821,
    workflowId: 1,
    runNumber: 4821,
    headBranch: 'main',
    event: 'push',
    status: 'completed',
    conclusion: 'failure',
    createdAt: ago(14 * MINUTE),
    runStartedAt: ago(14 * MINUTE),
    updatedAt: ago(14 * MINUTE - 192_000),
    htmlUrl: 'https://github.com/fitloop/webapp/actions/runs/4821',
    headSha: '4f1c9e2a6b7d8e9f0a1b2c3d4e5f60718293a4b5',
    displayTitle: 'Move design tokens into the ui package',
    workflowName: 'Deploy',
    headCommitMessage: 'Move design tokens into the ui package\n\nAnd the rest.',
    runAttempt: 1,
};

const meta = {
    component: WorkflowRunSummary,
    args: {
        run: RUN,
        gitRef: { name: 'main', kind: 'branch' },
        stillBroken: false,
        now: SAMPLE_WORKFLOWS_NOW,
    },
    decorators: [() => ({ template: '<div style="width: 900px"><story /></div>' })],
} satisfies Meta<typeof WorkflowRunSummary>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A failed run: when and how long it took. */
export const Failed: Story = {};

/** A run that passed. */
export const Passed: Story = { args: { run: { ...RUN, conclusion: 'success' } } };

/** A conclusion that says nothing shows that conclusion. */
export const Cancelled: Story = { args: { run: { ...RUN, conclusion: 'cancelled' } } };

/** Still going: since when. */
export const Running: Story = {
    args: { run: { ...RUN, status: 'in_progress', conclusion: null } },
};

/** Still going, on a workflow that stays broken. */
export const RunningStillBroken: Story = {
    args: { run: { ...RUN, status: 'in_progress', conclusion: null }, stillBroken: true },
};

/** Not started: GitHub's own status. */
export const Queued: Story = { args: { run: { ...RUN, status: 'queued', conclusion: null } } };

/** A day or more ago: its date and how many days. */
export const DaysAgo: Story = {
    args: {
        run: { ...RUN, createdAt: ago(3 * DAY), runStartedAt: ago(3 * DAY), updatedAt: ago(3 * DAY - 192_000) },
    },
};

/** An attempt past the first says which. */
export const SecondAttempt: Story = { args: { run: { ...RUN, runAttempt: 2 } } };

/** Run on a tag. */
export const OnTag: Story = { args: { gitRef: { name: 'v2.4.1', kind: 'tag' } } };

/** GitHub names no ref. */
export const NoRef: Story = { args: { gitRef: null } };

/** From the local copy, the run itself not read yet: GitHub's title stands in for the commit's. */
export const LocalCopy: Story = {
    args: { run: { ...RUN, workflowName: null, headCommitMessage: null, runAttempt: null } },
};

/** A commit title wider than the row. */
export const LongTitle: Story = {
    args: { run: { ...RUN, headCommitMessage: 'Move design tokens into the ui package and more '.repeat(6) } },
};

/** A deep link with nothing known of the run: a placeholder, no spinner. */
export const NothingKnown: Story = { args: { run: null, gitRef: null } };

function ago(ms: number) {
    return new Date(SAMPLE_WORKFLOWS_NOW - ms).toISOString();
}
