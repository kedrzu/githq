import type { GitHubWorkflowRunDetail } from '@githq/github/rest/getWorkflowRun.js';
import type { GitHubWorkflowJob } from '@githq/github/rest/listRunJobs.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import { hasRole } from '@/edits/getEditPermissions.js';
import type { RepositoryMetadata } from '@/repos/RepositoryTypes.js';

import { getJobMark } from './utils/getJobMark.js';
import type { WorkflowJobMark } from './utils/getJobMark.js';
import { getRunVerdict } from './utils/getRunVerdict.js';
import type { ParsedJobLog } from './utils/parseJobLog.js';
import type { WorkflowJobsState, WorkflowLogState, WorkflowRunState } from './WorkflowRunStore.js';

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
    /**
     * The job asked for by the address when the run has it, else the one shown so far, else the first of {@link jobs}:
     * its first failed one.
     */
    readonly selectedJob: GitHubWorkflowJob | null;
    readonly body: WorkflowRunBody;
    /**
     * More may change: GitHub still shows the run, and it has not finished, or a job known has not. The page keeps asking
     * GitHub meanwhile (W4j).
     */
    readonly going: boolean;
    /** The jobs "Re-run failed jobs" would re-run: those failed, once the run stopped going. */
    readonly rerunnableJobs: readonly GitHubWorkflowJob[];
}

/** What a run's page is built from. */
export interface BuildWorkflowRunParams {
    readonly run: WorkflowRunState;
    readonly jobs: WorkflowJobsState;
    /** The job the address names; `null` with none. */
    readonly jobId: number | null;
    /**
     * The job shown so far; `null` with none. The order of {@link WorkflowRunModel.jobs} changes with each poll: with no
     * job in the address, this is what keeps a job that passes, or another that fails, from changing what is being read.
     */
    readonly shownJobId: number | null;
}

/** What a job's log pane shows. */
export type WorkflowLogPane =
    /** Nothing to read yet: GitHub does not stream a running job's log, and may answer 404 for it (W4j). */
    | { readonly kind: 'running'; readonly job: GitHubWorkflowJob }
    /** It never ran, so it has no log: skipped, or cancelled before it started. */
    | { readonly kind: 'neverRan'; readonly job: GitHubWorkflowJob }
    /**
     * On its way; `null` while no job is known yet (W4e). `notThereYet`: GitHub says it has no log, but the job has only
     * just finished, and its log takes a moment to land: the page asks again.
     */
    | { readonly kind: 'loading'; readonly job: GitHubWorkflowJob | null; readonly notThereYet?: boolean }
    /** Past GitHub's retention (W4g). */
    | { readonly kind: 'gone'; readonly job: GitHubWorkflowJob }
    /** This log failed to read; the rest of the page goes on (W4i). */
    | { readonly kind: 'failed'; readonly job: GitHubWorkflowJob; readonly httpStatus: number | null }
    /** Past what the app reads at most: GitHub is the way, as trying again would read as much again. */
    | { readonly kind: 'tooLarge'; readonly job: GitHubWorkflowJob }
    /** The app turned the log down, GitHub having no part in it. */
    | { readonly kind: 'refused'; readonly job: GitHubWorkflowJob }
    | { readonly kind: 'ready'; readonly job: GitHubWorkflowJob; readonly log: ParsedJobLog };

/** What decides a job's log pane. */
export interface GetWorkflowLogPaneParams {
    readonly job: GitHubWorkflowJob | null;
    /** Starts the read the first time it is asked. */
    readonly readLog: (job: GitHubWorkflowJob) => WorkflowLogState;
    /** Epoch ms "just finished" is counted from. */
    readonly now: number;
}

/** How long after a job finishes GitHub saying it has no log means "not yet", not "no longer". */
const LOG_LANDING_MS = 5 * 60_000;

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
    const { run: runState, jobs: jobsState, jobId, shownJobId } = params;
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

    const body = getBody(runState, jobsState);
    const going =
        body.kind !== 'gone' &&
        ((run !== null && run.status !== 'completed') || jobs.some(job => job.status !== 'completed'));
    return {
        run,
        jobs,
        counts,
        selectedJob: jobs.find(job => job.id === jobId) ?? jobs.find(job => job.id === shownJobId) ?? jobs[0] ?? null,
        body,
        going,
        rerunnableJobs: going || run === null ? [] : jobs.filter(job => getJobMark(job) === 'failed'),
    };
}

/**
 * Whether "Re-run failed jobs" is offered (actions W4k): something failed and the run stopped going, and the user may, as
 * with every edit githq knows they can't make: write or above, not in an archived repository. Not while that isn't known.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function canRerunFailedJobs(
    model: WorkflowRunModel,
    metadata: Pick<RepositoryMetadata, 'isArchived' | 'viewerPermission'> | undefined,
): boolean {
    return model.rerunnableJobs.length > 0 && !metadata?.isArchived && hasRole(metadata?.viewerPermission, 'WRITE');
}

/**
 * What a job's log pane shows. Reads the log only for a job that finished and ran: a running job's may answer 404, which
 * would read as gone; and so does one cancelled before it started, which has no steps to show for it, and no log ever.
 */
export function getWorkflowLogPane(params: GetWorkflowLogPaneParams): WorkflowLogPane {
    const { job, readLog, now } = params;
    if (!job) {
        return { kind: 'loading', job };
    }

    const mark = getJobMark(job);
    switch (mark) {
        case 'running':
        case 'waiting':
            return { kind: 'running', job };
        case 'skipped':
            return { kind: 'neverRan', job };
        case 'none':
            return job.steps.length === 0 ? { kind: 'neverRan', job } : getReadPane(job, readLog(job), now);
        case 'failed':
        case 'passed':
            return getReadPane(job, readLog(job), now);
        default:
            return assertNever(mark);
    }
}

function getReadPane(job: GitHubWorkflowJob, state: WorkflowLogState, now: number): WorkflowLogPane {
    switch (state.status) {
        case 'loading':
            return { kind: 'loading', job };
        case 'ready':
            return { kind: 'ready', job, log: state.log };
        case 'gone':
            return isJustFinished(job, now) ? { kind: 'loading', job, notThereYet: true } : { kind: 'gone', job };
        case 'failed':
            return { kind: 'failed', job, httpStatus: state.httpStatus };
        case 'tooLarge':
        case 'refused':
            return { kind: state.status, job };
        default:
            return assertNever(state);
    }
}

function isJustFinished(job: GitHubWorkflowJob, now: number) {
    return job.completedAt !== null && now - Date.parse(job.completedAt) < LOG_LANDING_MS;
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
