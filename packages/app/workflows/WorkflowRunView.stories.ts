import type { GitHubWorkflowRunDetail } from '@githq/github/rest/getWorkflowRun.js';
import type { GitHubWorkflowJob, GitHubWorkflowStep } from '@githq/github/rest/listRunJobs.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { SAMPLE_WORKFLOWS_NOW } from '@/testing/sampleWorkflows.js';

import { buildWorkflowRun, getWorkflowLogPane } from './buildWorkflowRun.js';
import type { BuildWorkflowRunParams } from './buildWorkflowRun.js';
import { parseJobLog } from './utils/parseJobLog.js';
import type { WorkflowLogState } from './WorkflowRunStore.js';
import WorkflowRunView from './WorkflowRunView.vue';

const MINUTE = 60_000;
const STEP_MS = 10_000;
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
    actorLogin: 'mlaine',
    runAttempt: 1,
};

const BUILD_STEPS = [
    step(1, 'Set up job', 'success'),
    step(2, 'Checkout', 'success'),
    step(3, 'Run bun run build', 'failure'),
    step(4, 'Upload artifact', 'skipped'),
    step(5, 'Complete job', 'success'),
];

const JOBS = [
    job(101, 'lint', 'success'),
    job(102, 'deploy', 'skipped'),
    job(103, 'build', 'failure', BUILD_STEPS),
    job(104, 'typecheck', 'success', [step(1, 'Set up job', 'success')]),
];

const RUNNING_RUN: GitHubWorkflowRunDetail = { ...RUN, status: 'in_progress', conclusion: null };

const LOG_TEXT = [
    `${stepStart(1)} Runner image`,
    `${stepStart(2)} Fetching`,
    `${stepStart(3)} ##[group]Run bun run build`,
    `${stepStart(3)} <b>building</b> the bundle`,
    `${stepStart(3)} ##[error]Process completed with exit code 1.`,
].join('\n');

const meta = {
    component: WorkflowRunView,
    args: {
        ...viewOf({}, () => ({ status: 'ready', log: parseJobLog(LOG_TEXT, BUILD_STEPS) })),
        lineAddress: null,
        onSelectJob: fn(),
        onRetry: fn(),
        onOpenOnGitHub: fn(),
        onClose: fn(),
    },
    decorators: [() => ({ template: '<div style="height: 700px"><story /></div>' })],
} satisfies Meta<typeof WorkflowRunView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** W4a: failed first; the failed job selected, its steps shown, its log in the pane, opened at its error. */
export const Failed: Story = {};

/** The address names another job: it is selected, with its steps. */
export const OtherJob: Story = {
    args: viewOf({ jobId: 104 }, () => ({ status: 'ready', log: parseJobLog(LOG_TEXT, JOBS[3]?.steps ?? []) })),
};

/** W4e: what is known is there; the jobs and the log wait in place. */
export const JobsLoading: Story = {
    args: viewOf({ jobs: { jobs: [], status: 'loading', httpStatus: null } }, () => ({ status: 'loading' })),
};

/** W4e, a moment later: the jobs are in, the log still on its way. */
export const LogLoading: Story = { args: viewOf({}, () => ({ status: 'loading' })) };

/** A deep link with nothing known yet: placeholders, no spinner. */
export const NothingKnown: Story = {
    args: viewOf(
        {
            run: { run: null, status: 'loading', httpStatus: null },
            jobs: { jobs: [], status: 'loading', httpStatus: null },
        },
        () => ({ status: 'loading' }),
    ),
};

/** W4f: a failed run with no jobs. */
export const InvalidFile: Story = {
    args: {
        ...viewOf({ jobs: { jobs: [], status: 'ready', httpStatus: null } }, () => ({ status: 'loading' })),
        workflowPath: '.github/workflows/deploy.yml',
    },
};

/** W4g: past retention, the jobs and steps still there. */
export const LogGone: Story = {
    args: viewOf({ run: { run: { ...RUN, createdAt: ago(98 * DAY) }, status: 'ready', httpStatus: null } }, () => ({
        status: 'gone',
    })),
};

/** W4i: one job's log failed, with GitHub's real status; Enter tries again. */
export const LogFailed: Story = { args: viewOf({}, () => ({ status: 'failed', httpStatus: 502 })) };

/** W4i with no answer at all. */
export const LogNoAnswer: Story = { args: viewOf({}, () => ({ status: 'failed', httpStatus: null })) };

/** W4j: the run still going, its running job selected, no log read for it. */
export const Running: Story = {
    args: {
        ...viewOf(
            {
                run: { run: RUNNING_RUN, status: 'ready', httpStatus: null },
                jobs: {
                    jobs: [
                        job(101, 'lint', 'success'),
                        job(105, 'build', null, [step(1, 'Set up job', 'success'), step(2, 'Run bun run build', null)]),
                        job(106, 'deploy', null, [], 'waiting'),
                    ],
                    status: 'ready',
                    httpStatus: null,
                },
            },
            () => ({ status: 'loading' }),
        ),
        stillBroken: true,
    },
};

/** A run tried again: the summary says which attempt. */
export const SecondAttempt: Story = {
    args: viewOf({ run: { run: { ...RUN, runAttempt: 2 }, status: 'ready', httpStatus: null } }, () => ({
        status: 'ready',
        log: parseJobLog(LOG_TEXT, BUILD_STEPS),
    })),
};

/** A run that passed: its first job selected, no error. */
export const Passed: Story = {
    args: viewOf(
        {
            run: { run: { ...RUN, conclusion: 'success' }, status: 'ready', httpStatus: null },
            jobs: { jobs: [job(101, 'lint', 'success')], status: 'ready', httpStatus: null },
        },
        () => ({ status: 'ready', log: parseJobLog('2026-11-02T11:46:01.0000000Z All good', []) }),
    ),
};

/** A skipped job never ran: its pane says so. */
export const JobSkipped: Story = { args: viewOf({ jobId: 102 }, () => ({ status: 'loading' })) };

/** GitHub has no such run, or won't show it. */
export const RunGone: Story = {
    args: viewOf({ run: { run: null, status: 'gone', httpStatus: null } }, () => ({ status: 'loading' })),
};

/** The run failed to read with nothing known of it. */
export const RunFailed: Story = {
    args: viewOf({ run: { run: null, status: 'failed', httpStatus: 500 } }, () => ({ status: 'loading' })),
};

/** The jobs failed to read; what is known of the run stays. */
export const JobsFailed: Story = {
    args: viewOf({ jobs: { jobs: [], status: 'failed', httpStatus: 503 } }, () => ({ status: 'loading' })),
};

/** The run going, no job started yet. */
export const NoJobYet: Story = {
    args: viewOf(
        {
            run: { run: { ...RUNNING_RUN, status: 'queued' }, status: 'ready', httpStatus: null },
            jobs: { jobs: [], status: 'ready', httpStatus: null },
        },
        () => ({ status: 'loading' }),
    ),
};

function viewOf(params: Partial<BuildWorkflowRunParams>, readLog: () => WorkflowLogState) {
    const model = buildWorkflowRun({
        run: { run: RUN, status: 'ready', httpStatus: null },
        jobs: { jobs: JOBS, status: 'ready', httpStatus: null },
        jobId: null,
        ...params,
    });
    return {
        nameWithOwner: 'fitloop/webapp',
        runId: RUN.id,
        model,
        logPane: getWorkflowLogPane(
            model.body.kind === 'jobs' ? model.selectedJob : null,
            readLog,
            SAMPLE_WORKFLOWS_NOW,
        ),
        gitRef: { name: 'main', kind: 'branch' } as const,
        workflowPath: null,
        stillBroken: false,
        now: SAMPLE_WORKFLOWS_NOW,
    };
}

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
        completedAt: conclusion === null ? null : ago(14 * MINUTE - 151_000),
        htmlUrl: `https://github.com/fitloop/webapp/actions/runs/4821/job/${id}`,
        steps,
    };
}

function step(number: number, name: string, conclusion: string | null): GitHubWorkflowStep {
    return {
        name,
        number,
        status: conclusion === null ? 'in_progress' : 'completed',
        conclusion,
        startedAt: stepStart(number),
        completedAt: conclusion === null ? null : ago(14 * MINUTE - number * STEP_MS - 3000),
    };
}
