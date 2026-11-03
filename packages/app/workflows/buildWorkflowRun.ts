import type { GitHubWorkflowRunDetail } from '@githq/github/rest/getWorkflowRun.js';
import type { GitHubWorkflowJob } from '@githq/github/rest/listRunJobs.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import { getRunVerdict } from './utils/getRunVerdict.js';
import type { ParsedJobLog } from './utils/parseJobLog.js';
import type { WorkflowJobsState, WorkflowLogState, WorkflowRunState } from './WorkflowRunStore.js';

/** How a job or a step stands: by its status while it has not finished, by its conclusion after. */
export type WorkflowJobMark = 'failed' | 'running' | 'waiting' | 'skipped' | 'passed' | 'none';

/** What the page shows under the run's summary. */
export type WorkflowRunBody =
    /** The jobs are on their way: placeholders in place of the columns (W4e). */
    | { readonly kind: 'loading' }
    /** The columns: the jobs and the selected job's log. */
    | { readonly kind: 'jobs' }
    /** GitHub has no such run, or will not show it. */
    | { readonly kind: 'gone' }
    /** The run was not read, and nothing is known of it. */
    | { readonly kind: 'runFailed'; readonly httpStatus: number | null }
    /** The run's jobs were not read. */
    | { readonly kind: 'jobsFailed'; readonly httpStatus: number | null }
    /** A failed run with no jobs: its workflow file is invalid (W4f). */
    | { readonly kind: 'invalidFile' }
    /** A run with no jobs that did not fail: not started yet, or it finished without any. */
    | { readonly kind: 'noJobs'; readonly going: boolean };

/** How many of a run's jobs stand how, as the Jobs column's head says it. */
export type WorkflowJobCounts = Readonly<Record<WorkflowJobMark, number>>;

/** A run's page, from what the store knows of it. */
export interface WorkflowRunModel {
    /** `null` until it is read, with the sync's copy not knowing it. */
    readonly run: GitHubWorkflowRunDetail | null;
    /** Failed first, then those not finished, the others in GitHub's order. */
    readonly jobs: readonly GitHubWorkflowJob[];
    readonly counts: WorkflowJobCounts;
    /** The job asked for by the address when the run has it, else the first of {@link jobs}: its first failed one. */
    readonly selectedJob: GitHubWorkflowJob | null;
    readonly body: WorkflowRunBody;
    /** More may change: the run has not finished, or a job known has not. The page keeps asking GitHub meanwhile (W4j). */
    readonly going: boolean;
}

/** What a run's page is built from. */
export interface BuildWorkflowRunParams {
    readonly run: WorkflowRunState;
    readonly jobs: WorkflowJobsState;
    /** The job the address names; `null` with none. */
    readonly jobId: number | null;
}

/** What a job's log pane shows. */
export type WorkflowLogPane =
    /** Nothing to read yet: GitHub does not stream a running job's log, and may answer 404 for it (W4j). */
    | { readonly kind: 'running'; readonly job: GitHubWorkflowJob }
    /** It never ran, so it has no log. */
    | { readonly kind: 'skipped'; readonly job: GitHubWorkflowJob }
    /** On its way; `null` while no job is known yet (W4e). */
    | { readonly kind: 'loading'; readonly job: GitHubWorkflowJob | null }
    /** Past GitHub's retention (W4g). */
    | { readonly kind: 'gone'; readonly job: GitHubWorkflowJob }
    /** This log failed to read; the rest of the page goes on (W4i). */
    | { readonly kind: 'failed'; readonly job: GitHubWorkflowJob; readonly httpStatus: number | null }
    | { readonly kind: 'ready'; readonly job: GitHubWorkflowJob; readonly log: ParsedJobLog };

const MARK_RANK: Readonly<Record<WorkflowJobMark, number>> = {
    failed: 0,
    running: 1,
    waiting: 1,
    skipped: 2,
    passed: 2,
    none: 2,
};

/**
 * What a run's page shows (actions W4a, W4e–W4j), worked out from what the store knows. What is known always shows: a
 * failure to read says so only where nothing stands in for it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildWorkflowRun(params: BuildWorkflowRunParams): WorkflowRunModel {
    const { run: runState, jobs: jobsState, jobId } = params;
    const { run } = runState;
    const jobs = jobsState.jobs.toSorted((a, b) => MARK_RANK[getJobMark(a)] - MARK_RANK[getJobMark(b)]);
    const counts: Record<WorkflowJobMark, number> = {
        failed: 0,
        running: 0,
        waiting: 0,
        skipped: 0,
        passed: 0,
        none: 0,
    };
    for (const job of jobs) {
        counts[getJobMark(job)] += 1;
    }

    return {
        run,
        jobs,
        counts,
        selectedJob: jobs.find(job => job.id === jobId) ?? jobs[0] ?? null,
        body: getBody(runState, jobsState),
        going: (run !== null && run.status !== 'completed') || jobs.some(job => job.status !== 'completed'),
    };
}

/**
 * How a job or a step stands.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getJobMark(job: Pick<GitHubWorkflowJob, 'status' | 'conclusion'>): WorkflowJobMark {
    if (job.status !== 'completed') {
        return job.status === 'in_progress' ? 'running' : 'waiting';
    }

    if (job.conclusion === 'skipped') {
        return 'skipped';
    }

    return getRunVerdict(job) ?? 'none';
}

/**
 * What a job's log pane shows. Reads the log only for a job that finished and ran: a running job's may answer 404, which
 * would read as gone.
 *
 * @param readLog Starts the read the first time it is asked.
 */
export function getWorkflowLogPane(
    job: GitHubWorkflowJob | null,
    readLog: (job: GitHubWorkflowJob) => WorkflowLogState,
): WorkflowLogPane {
    if (!job) {
        return { kind: 'loading', job };
    }

    switch (getJobMark(job)) {
        case 'running':
        case 'waiting':
            return { kind: 'running', job };
        case 'skipped':
            return { kind: 'skipped', job };
        default:
            return getReadPane(job, readLog(job));
    }
}

function getReadPane(job: GitHubWorkflowJob, state: WorkflowLogState): WorkflowLogPane {
    switch (state.status) {
        case 'loading':
            return { kind: 'loading', job };
        case 'ready':
            return { kind: 'ready', job, log: state.log };
        case 'gone':
            return { kind: 'gone', job };
        case 'failed':
            return { kind: 'failed', job, httpStatus: state.httpStatus };
        default:
            return assertNever(state);
    }
}

function getBody(runState: WorkflowRunState, jobsState: WorkflowJobsState): WorkflowRunBody {
    const { run } = runState;
    if (runState.status === 'gone' || jobsState.status === 'gone') {
        return { kind: 'gone' };
    }

    if (run === null && runState.status === 'failed') {
        return { kind: 'runFailed', httpStatus: runState.httpStatus };
    }

    if (jobsState.jobs.length > 0) {
        return { kind: 'jobs' };
    }

    switch (jobsState.status) {
        case 'loading':
            return { kind: 'loading' };
        case 'failed':
            return { kind: 'jobsFailed', httpStatus: jobsState.httpStatus };
        default:
            return getNoJobsBody(run);
    }
}

function getNoJobsBody(run: GitHubWorkflowRunDetail | null): WorkflowRunBody {
    if (run === null) {
        return { kind: 'loading' };
    }

    if (run.status !== 'completed') {
        return { kind: 'noJobs', going: true };
    }

    return getRunVerdict(run) === 'failed' ? { kind: 'invalidFile' } : { kind: 'noJobs', going: false };
}
