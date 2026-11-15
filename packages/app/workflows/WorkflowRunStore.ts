import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import type { GitHubRestRequester } from '@githq/github/rest/createGitHubRestRequester.js';
import { getWorkflowRun } from '@githq/github/rest/getWorkflowRun.js';
import type { GitHubWorkflowRunDetail } from '@githq/github/rest/getWorkflowRun.js';
import { listRunJobs } from '@githq/github/rest/listRunJobs.js';
import type { GitHubWorkflowJob, GitHubWorkflowStep } from '@githq/github/rest/listRunJobs.js';
import { readJobLog } from '@githq/github/rest/readJobLog.js';
import { rerunFailedJobs } from '@githq/github/rest/rerunFailedJobs.js';
import { rerunWorkflowJob } from '@githq/github/rest/rerunWorkflowJob.js';
import { rerunWorkflowRun } from '@githq/github/rest/rerunWorkflowRun.js';
import { cancelWorkflowRun } from '@githq/github/rest/cancelWorkflowRun.js';
import { setWorkflowEnabled } from '@githq/github/rest/setWorkflowEnabled.js';
import type { GitHubWorkflow } from '@githq/github/rest/listWorkflows.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { createLruCache } from '@nzyme/utils/createLruCache.js';
import type { LruCache } from '@nzyme/utils/createLruCache.js';
import { shallowRef } from 'vue';
import type { ShallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { Clock } from '@/services/Clock.js';
import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { GitHubRestFactory } from '@/services/GitHubRestFactory.js';
import type { Freshness } from '@/sync/Freshness.js';
import { getAllowancePause } from '@/sync/getAllowancePause.js';
import { ReloadHolds } from '@/sync/ReloadHolds.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import { getJobMark } from './utils/getJobMark.js';
import { JobLogRefusal } from './utils/JobLogRefusal.js';
import { getRerunReason } from './utils/getRerunReason.js';
import type { WorkflowAction, WorkflowRerunReason } from './utils/getRerunReason.js';
import { parseJobLog } from './utils/parseJobLog.js';
import type { ParsedJobLog } from './utils/parseJobLog.js';
import { WorkflowRunHistory } from './WorkflowRunHistory.js';
import { WorkflowStore } from './WorkflowStore.js';
import type { RepositoryWorkflows } from './WorkflowTypes.js';

/** How many logs stay in memory: reading one costs little, keeping many costs a lot (actions D12). */
const KEPT_LOGS = 5;
/**
 * How long a re-run GitHub took shows as running with GitHub's reads still saying it ended: its answers may lag behind.
 * After that GitHub's word stands, so a re-run that never shows up does not keep the page asking for good.
 */
const RERUN_LANDING_MS = 2 * 60_000;

/**
 * How reading from GitHub went. `gone`: GitHub no longer has it, past its retention or never there; `failed`: it was
 * not read, asking again may help.
 */
export type WorkflowReadStatus = 'loading' | 'ready' | 'gone' | 'failed';

/** A run: what is known of it at once, and how reading it went. */
export interface WorkflowRunState {
    /** As read; until then as the sync stored it, without what only the run's own answer says; `null` with neither. */
    readonly run: GitHubWorkflowRunDetail | null;
    readonly status: WorkflowReadStatus;
    /** The status GitHub refused with, when `failed`; `null` for no answer, or nothing asked with the allowance used up. */
    readonly httpStatus: number | null;
}

/** A run's jobs and how reading them went. */
export interface WorkflowJobsState {
    readonly jobs: readonly GitHubWorkflowJob[];
    readonly status: WorkflowReadStatus;
    /** The status GitHub refused with, when `failed`; `null` for no answer, or nothing asked with the allowance used up. */
    readonly httpStatus: number | null;
    /** When GitHub last answered for them, a 304 too (epoch ms); `null` until it has. */
    readonly checkedAt: number | null;
}

/** A job's log and how reading it went. */
export type WorkflowLogState =
    | { readonly status: 'loading' }
    | { readonly status: 'ready'; readonly log: ParsedJobLog }
    | { readonly status: 'gone' }
    | {
          readonly status: 'failed';
          /** The status GitHub refused with; `null` for no answer, or nothing asked with the allowance used up. */
          readonly httpStatus: number | null;
      }
    /** Past what the app reads at most: reading it again would only read as much again. */
    | { readonly status: 'tooLarge' }
    /** The app turned it down, GitHub having no part in it. */
    | { readonly status: 'refused' };

/** What a {@link WorkflowAction} was asked of: a run, or a workflow. */
export type WorkflowActionTarget =
    | {
          readonly kind: 'run';
          readonly runId: number;
          /** The run's workflow as GitHub names it; `null` when it does not. */
          readonly workflowName: string | null;
          readonly runNumber: number;
      }
    | {
          readonly kind: 'workflow';
          readonly workflowName: string;
          /** The workflow on GitHub. */
          readonly url: string;
      };

/**
 * What GitHub did not do to a run or a workflow (a re-run, a cancel, turning it off or on), and why: its toast and the
 * status bar's segment (W4l).
 */
export interface WorkflowRerunFailure {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly action: WorkflowAction;
    readonly target: WorkflowActionTarget;
    readonly reason: WorkflowRerunReason;
    /** Its toast is showing. */
    readonly toast: boolean;
    /** Epoch ms it was reported: the status bar says the newest of what it has to say. */
    readonly at: number;
}

/** A run to act on, as the caller shows it: maybe one of a workflow's older runs, which the store never read. */
export interface WorkflowRunTarget {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly run: GitHubWorkflowRunDetail;
}

/** A job of a run to re-run. */
export interface WorkflowJobTarget extends WorkflowRunTarget {
    readonly jobId: number;
}

/** A workflow to turn off or on. */
export interface WorkflowEnableTarget {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly workflowId: number;
    readonly enabled: boolean;
}

/** A re-run asked for, drawn over what GitHub's reads say until they show it (W4j). */
interface RunRerun {
    /** The attempt the run was on when it was asked. */
    readonly attempt: number;
    /**
     * The jobs it re-runs, each with when it had finished as it was asked: one GitHub's read shows finished then is drawn
     * running; once it shows it running again, or finished at another time, GitHub's word stands.
     */
    readonly jobs: ReadonlyMap<number, string | null>;
    /** ISO. */
    readonly startedAt: string;
}

/** What a run's or its jobs' conditional read says. */
type ConditionalAnswer<T> = { status: 304 } | { status: 200; etag: string | undefined; value: T } | { status: 'gone' };

/** What is known of a run or its jobs, and how to ask whether it changed. */
interface ConditionalRead<T> {
    readonly state: ShallowRef<{
        readonly value: T | null;
        readonly status: WorkflowReadStatus;
        readonly httpStatus: number | null;
        readonly checkedAt: number | null;
    }>;
    etag: string | undefined;
    reading: boolean;
    readonly load: (etag: string | undefined) => Promise<ConditionalAnswer<T>>;
}

/** The signed-in user and all that was read for them, dropped with them. */
interface RunSession {
    readonly account: Account;
    readonly rest: GitHubRestRequester;
    readonly runs: Map<string, ConditionalRead<GitHubWorkflowRunDetail>>;
    readonly jobs: Map<string, ConditionalRead<readonly GitHubWorkflowJob[]>>;
    readonly logs: LruCache<string, ShallowRef<WorkflowLogState>>;
    readonly reruns: ShallowRef<ReadonlyMap<string, RunRerun>>;
    /** How many re-runs, cancels and workflows turned off or on GitHub has not answered yet. */
    readonly onTheirWay: ShallowRef<number>;
    /** The latest of them that failed, until dismissed: one at a time. */
    readonly rerunFailure: ShallowRef<WorkflowRerunFailure | null>;
}

/** Which job's log to read: also what {@link WorkflowRunStore}'s `retry` takes. */
export interface GetLogParams {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly jobId: number;
    readonly steps: readonly GitHubWorkflowStep[];
}

/** Which job's log is being read, for whom, and where it goes. */
interface LogParams extends GetLogParams {
    readonly current: RunSession;
    readonly state: ShallowRef<WorkflowLogState>;
}

/** Whose run, or jobs of a run, to open. */
interface OpenRunParams {
    readonly current: RunSession;
    readonly nameWithOwner: string;
    readonly runId: number;
}

/** A conditional read to open, unless it is known already. */
interface OpenParams<T> {
    readonly current: RunSession;
    readonly reads: Map<string, ConditionalRead<T>>;
    readonly key: string;
    readonly load: ConditionalRead<T>['load'];
}

/** A re-run to start: of which run, which jobs, and how GitHub is asked. */
interface StartRerunParams extends WorkflowRunTarget {
    readonly action: WorkflowAction;
    readonly jobs: readonly GitHubWorkflowJob[];
    readonly request: (rest: GitHubRestRequester) => Promise<void>;
}

/** An action asked of GitHub, and what to do with its answer. */
interface SendParams extends BeginParams {
    readonly request: () => Promise<void>;
    /** GitHub took it. */
    readonly sent?: () => void;
    /** GitHub did not: takes back what showed it done. */
    readonly undo?: () => void;
    /** Whatever the answer, once it came. */
    readonly settled?: () => void;
}

/** An action about to be asked of GitHub, for whom and of what. */
interface BeginParams {
    readonly current: RunSession;
    readonly nameWithOwner: string;
    readonly action: WorkflowAction;
    readonly target: WorkflowActionTarget;
}

/** An action's refusal to keep. */
interface PutFailureParams extends BeginParams {
    readonly reason: WorkflowRerunReason;
}

/** The layer of a re-run to drop, for whom and under which key. */
interface DropRerunParams {
    readonly current: RunSession;
    readonly key: string;
    readonly layer: RunRerun;
}

const LOADING: WorkflowLogState = { status: 'loading' };

/**
 * A run, its jobs and its jobs' logs, read from GitHub when a failure is opened (actions D3, D12) and only then, nothing
 * asked while the core allowance is used up. Held in memory for the signed-in user only, never on disk: a few logs at a
 * time, the least recently asked dropping out.
 *
 * Each `get…` starts the read the first time it is asked, so it may be called from a `computed`: what it writes is its
 * own new state, which nothing watches yet.
 *
 * Re-running a run's failed jobs, all of them or one (actions D10, W4j, W4l) starts here too, and shows at once: the run
 * and the jobs read as running, until GitHub's reads say so themselves. GitHub refusing it takes that back and is said
 * by a toast and the status bar's segment of its own: a re-run is no item's edit, so it stays out of the `EditQueue`.
 * Cancelling a run and turning a workflow off or on go the same way.
 */
export type WorkflowRunStore = Resolved<typeof WorkflowRunStore>;
export const WorkflowRunStore = defineService({
    name: 'WorkflowRunStore',
    deps: {
        accounts: AccountSession,
        workflows: WorkflowStore,
        history: WorkflowRunHistory,
        createRest: GitHubRestFactory,
        rateLimits: GitHubRateLimitStore,
        holds: ReloadHolds,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, workflows, history, createRest, rateLimits, holds, clock, logger }) {
        const sessionRef = shallowRef<RunSession | null>(null);
        const pageFreshnessRef = shallowRef<Freshness | null>(null);

        accounts.onChange(account => {
            sessionRef.value = account
                ? {
                      account,
                      rest: createRest(account.getToken),
                      runs: new Map(),
                      jobs: new Map(),
                      logs: createLruCache({ maxSize: KEPT_LOGS }),
                      reruns: shallowRef(new Map()),
                      onTheirWay: shallowRef(0),
                      rerunFailure: shallowRef(null),
                  }
                : null;
        });
        // A reload would lose the answer, or a failure not dismissed yet: only this tab's memory holds them.
        holds.holdWhile(() => {
            const current = sessionRef.value;
            return current !== null && (current.onTheirWay.value > 0 || current.rerunFailure.value !== null);
        });

        return {
            /** What the run's page shown says in the status bar instead of the workflows' poll (W4e, W4i, W4j); `null` if nothing. */
            get pageFreshness() {
                return pageFreshnessRef.value;
            },
            setPageFreshness,
            /** The latest re-run that failed, until dismissed; reactive. */
            get rerunFailure() {
                return sessionRef.value?.rerunFailure.value ?? null;
            },
            setRerunToast,
            dismissRerunFailure,
            rerun,
            rerunAll,
            rerunJob,
            cancel,
            setEnabled,
            getRun,
            getJobs,
            refresh,
            getLog,
            retry,
        };

        function setPageFreshness(freshness: Freshness | null) {
            pageFreshnessRef.value = freshness;
        }

        /** Shows or hides the failed re-run's toast; it stays in the status bar until dismissed. */
        function setRerunToast(toast: boolean) {
            const current = sessionRef.value;
            const failure = current?.rerunFailure.value;
            if (current && failure) {
                current.rerunFailure.value = { ...failure, toast };
            }
        }

        function dismissRerunFailure() {
            const current = sessionRef.value;
            if (current) {
                current.rerunFailure.value = null;
            }
        }

        /**
         * Re-runs the run's failed jobs, showing that at once. Nothing while the run goes, which it does from here until
         * GitHub refuses: it cannot be sent twice. GitHub's answer ends up here, shown or not, and whatever it was the run
         * is asked for again: a refusal may say someone else re-ran it, and a failure says nothing of what got there.
         */
        function rerun(nameWithOwner: string, runId: number) {
            const { run } = getRun(nameWithOwner, runId);
            const jobs = getJobs(nameWithOwner, runId).jobs.filter(job => getJobMark(job) === 'failed');
            if (run && jobs.length > 0) {
                startRerun({
                    nameWithOwner,
                    run,
                    action: 'rerunFailed',
                    jobs,
                    request: rest => rerunFailedJobs(rest, { ...parseRepositoryName(nameWithOwner), runId }),
                });
            }
        }

        /** Re-runs every job of a run that finished, as {@link rerun} does its failed ones. */
        function rerunAll({ nameWithOwner, run }: WorkflowRunTarget) {
            startRerun({
                nameWithOwner,
                run,
                action: 'rerunAll',
                jobs: getKnownJobs(nameWithOwner, run.id),
                request: rest => rerunWorkflowRun(rest, { nameWithOwner, runId: run.id }),
            });
        }

        /** Re-runs one finished job of a run that finished, as {@link rerun} does its failed ones. */
        function rerunJob({ nameWithOwner, run, jobId }: WorkflowJobTarget) {
            const job = getKnownJobs(nameWithOwner, run.id).find(candidate => candidate.id === jobId);
            if (job?.status === 'completed') {
                startRerun({
                    nameWithOwner,
                    run,
                    action: 'rerunJob',
                    jobs: [job],
                    request: rest => rerunWorkflowJob(rest, { nameWithOwner, jobId }),
                });
            }
        }

        /**
         * Asks GitHub to cancel a run still going. GitHub cancels on its own time, so the run shows as GitHub's reads say,
         * asked again once it answers; a refusal is said as a re-run's is.
         */
        function cancel({ nameWithOwner, run }: WorkflowRunTarget) {
            const current = sessionRef.value;
            if (!current || getShownRun(current, nameWithOwner, run).status === 'completed') {
                return;
            }

            const target = getRunTarget(run);
            if (begin({ current, nameWithOwner, action: 'cancel', target })) {
                void send({
                    current,
                    nameWithOwner,
                    action: 'cancel',
                    target,
                    request: () => cancelWorkflowRun(current.rest, { nameWithOwner, runId: run.id }),
                    sent: () => history.refreshRuns({ nameWithOwner, workflowId: run.workflowId }),
                    settled: () => refresh(nameWithOwner, run.id),
                });
            }
        }

        /**
         * Turns a workflow off or on, its state showing that at once in what the sync keeps, until the sync's next read
         * of the repository's workflows says it itself. A refusal takes it back and is said as a re-run's is.
         */
        function setEnabled({ nameWithOwner, workflowId, enabled }: WorkflowEnableTarget) {
            const current = sessionRef.value;
            const before = workflows
                .get(nameWithOwner)
                ?.workflows.find(entry => entry.workflow.id === workflowId)?.workflow;
            if (!current || !before || (before.state === 'active') === enabled) {
                return;
            }

            const action = enabled ? 'enable' : 'disable';
            const target: WorkflowActionTarget = { kind: 'workflow', workflowName: before.name, url: before.htmlUrl };
            if (!begin({ current, nameWithOwner, action, target })) {
                return;
            }

            const after: GitHubWorkflow = { ...before, state: enabled ? 'active' : 'disabled_manually' };
            putWorkflow(nameWithOwner, after);
            void send({
                current,
                nameWithOwner,
                action,
                target,
                request: () => setWorkflowEnabled(current.rest, { nameWithOwner, workflowId, enabled }),
                // Unless a read of GitHub's took its place meanwhile, which says how it stands.
                undo: () => {
                    const shown = workflows
                        .get(nameWithOwner)
                        ?.workflows.find(entry => entry.workflow.id === workflowId);
                    if (shown?.workflow === after) {
                        putWorkflow(nameWithOwner, before);
                    }
                },
            });
        }

        /** Shows the run and its jobs running at once, and asks GitHub; nothing for a run that goes, re-run already. */
        function startRerun({ nameWithOwner, run, action, jobs, request }: StartRerunParams) {
            const current = sessionRef.value;
            if (!current || getShownRun(current, nameWithOwner, run).status !== 'completed') {
                return;
            }

            const target = getRunTarget(run);
            if (!begin({ current, nameWithOwner, action, target })) {
                return;
            }

            const key = getKey(nameWithOwner, run.id);
            const layer: RunRerun = {
                attempt: run.runAttempt,
                jobs: new Map(jobs.map(job => [job.id, job.completedAt])),
                startedAt: new Date(clock.now()).toISOString(),
            };
            current.reruns.value = new Map(current.reruns.value).set(key, layer);
            void send({
                current,
                nameWithOwner,
                action,
                target,
                request: () => request(current.rest),
                sent: () => {
                    // A job re-run under the same id has another log coming.
                    for (const jobId of layer.jobs.keys()) {
                        current.logs.delete(getKey(nameWithOwner, jobId));
                    }

                    clock.schedule(() => {
                        dropRerun({ current, key, layer });
                    }, RERUN_LANDING_MS);
                    // The workflow's runs list, when read, shows the run going again.
                    history.refreshRuns({ nameWithOwner, workflowId: run.workflowId });
                },
                undo: () => dropRerun({ current, key, layer }),
                settled: () => refresh(nameWithOwner, run.id),
            });
        }

        /**
         * Clears the last failure and counts the action on its way; with the allowance used up it is not sent, and says
         * so instead.
         */
        function begin(params: BeginParams) {
            params.current.rerunFailure.value = null;
            const pause = getAllowancePause(rateLimits.get('core'), clock.now());
            if (pause) {
                putFailure({ ...params, reason: { kind: 'allowance', until: pause.until } });
                return false;
            }

            params.current.onTheirWay.value += 1;
            return true;
        }

        async function send({ current, nameWithOwner, action, target, request, sent, undo, settled }: SendParams) {
            try {
                await request();
                if (!isCurrent(current)) {
                    return;
                }

                sent?.();
            } catch (error) {
                if (!isCurrent(current)) {
                    return;
                }

                logger.warn('GitHub did not do what was asked of a workflow or its run', { error, action });
                undo?.();
                const reason = getRerunReason({ error, action, limit: rateLimits.get('core'), now: clock.now() });
                putFailure({ current, nameWithOwner, action, target, reason });
            }

            current.onTheirWay.value -= 1;
            settled?.();
        }

        function putFailure({ current, nameWithOwner, action, target, reason }: PutFailureParams) {
            current.rerunFailure.value = { nameWithOwner, action, target, reason, toast: true, at: clock.now() };
        }

        /** The run as shown: running from the moment it is re-run. */
        function getShownRun(current: RunSession, nameWithOwner: string, run: GitHubWorkflowRunDetail) {
            const layer = current.reruns.value.get(getKey(nameWithOwner, run.id));
            return layer ? withRerun(run, layer) : run;
        }

        /** The run's jobs as last read, without asking GitHub for them: one of a workflow's older runs has none read. */
        function getKnownJobs(nameWithOwner: string, runId: number): readonly GitHubWorkflowJob[] {
            return sessionRef.value?.jobs.get(getKey(nameWithOwner, runId))?.state.value.value ?? [];
        }

        /** Puts the workflow in place of its namesake in what the sync keeps of its repository. */
        function putWorkflow(nameWithOwner: string, workflow: GitHubWorkflow) {
            const stored = workflows.get(nameWithOwner);
            if (stored) {
                workflows.set({
                    ...stored,
                    workflows: stored.workflows.map(entry =>
                        entry.workflow.id === workflow.id ? { ...entry, workflow } : entry,
                    ),
                });
            }
        }

        /** The run as the sync stored it, at once, then as read; running from the moment it is re-run. Reactive. */
        function getRun(nameWithOwner: string, runId: number): WorkflowRunState {
            const stored = findStoredRun(workflows.get(nameWithOwner), runId);
            const current = sessionRef.value;
            if (!current) {
                return { run: stored, status: 'loading', httpStatus: null };
            }

            const { value, status, httpStatus } = openRun({ current, nameWithOwner, runId }).state.value;
            const run = value ?? stored;
            const layer = current.reruns.value.get(getKey(nameWithOwner, runId));
            return { run: run && layer ? withRerun(run, layer) : run, status, httpStatus };
        }

        /** The run's jobs, none until read; the failed ones running from the moment the run is re-run. Reactive. */
        function getJobs(nameWithOwner: string, runId: number): WorkflowJobsState {
            const current = sessionRef.value;
            if (!current) {
                return { jobs: [], status: 'loading', httpStatus: null, checkedAt: null };
            }

            const { value, status, httpStatus, checkedAt } = openJobs({ current, nameWithOwner, runId }).state.value;
            const layer = current.reruns.value.get(getKey(nameWithOwner, runId));
            const read = layer && openRun({ current, nameWithOwner, runId }).state.value.value;
            const jobs =
                layer && !(read && hasFinishedAgain(read, layer)) ? withRerunJobs(value ?? [], layer) : (value ?? []);
            return { jobs, status, httpStatus, checkedAt };
        }

        /**
         * Asks whether the run and its jobs changed, for a run still going or one that failed to read: 304s are free,
         * and what is known and what was said stay meanwhile, and if the asking fails.
         */
        function refresh(nameWithOwner: string, runId: number) {
            const current = sessionRef.value;
            if (current) {
                ask(current, openRun({ current, nameWithOwner, runId }));
                ask(current, openJobs({ current, nameWithOwner, runId }));
            }
        }

        /** The job's log, read and parsed the first time it is asked. Reactive. */
        function getLog(params: GetLogParams): WorkflowLogState {
            const { nameWithOwner, jobId, steps } = params;
            const current = sessionRef.value;
            if (!current) {
                return LOADING;
            }

            const key = getKey(nameWithOwner, jobId);
            const known = current.logs.get(key);
            if (known) {
                return known.value;
            }

            const state = shallowRef(LOADING);
            current.logs.set(key, state);
            askLog({ current, state, nameWithOwner, jobId, steps });
            return state.value;
        }

        /** Reads the job's log again, whatever came of the last read; nothing while one is being read. */
        function retry(params: GetLogParams) {
            const { nameWithOwner, jobId, steps } = params;
            const current = sessionRef.value;
            const state = current?.logs.cache.get(getKey(nameWithOwner, jobId));
            if (!current || !state) {
                getLog(params);
            } else if (state.value.status !== 'loading') {
                askLog({ current, state, nameWithOwner, jobId, steps });
            }
        }

        function openRun({ current, nameWithOwner, runId }: OpenRunParams) {
            return open({
                current,
                reads: current.runs,
                key: getKey(nameWithOwner, runId),
                load: async etag => {
                    const answer = await getWorkflowRun(current.rest, { nameWithOwner, runId, etag });
                    return answer.status === 200 ? { status: 200, etag: answer.etag, value: answer.run } : answer;
                },
            });
        }

        function openJobs({ current, nameWithOwner, runId }: OpenRunParams) {
            return open({
                current,
                reads: current.jobs,
                key: getKey(nameWithOwner, runId),
                load: async etag => {
                    const answer = await listRunJobs(current.rest, { nameWithOwner, runId, etag });
                    return answer.status === 200 ? { status: 200, etag: answer.etag, value: answer.jobs } : answer;
                },
            });
        }

        function open<T>({ current, reads, key, load }: OpenParams<T>) {
            const known = reads.get(key);
            if (known) {
                return known;
            }

            const read: ConditionalRead<T> = {
                state: shallowRef({ value: null, status: 'loading', httpStatus: null, checkedAt: null }),
                etag: undefined,
                reading: false,
                load,
            };
            reads.set(key, read);
            ask(current, read);
            return read;
        }

        function ask<T>(current: RunSession, read: ConditionalRead<T>) {
            if (read.reading) {
                return;
            }

            if (getAllowancePause(rateLimits.get('core'), clock.now())) {
                putNotRead(read, null);
                return;
            }

            read.reading = true;
            void readConditional(current, read);
        }

        async function readConditional<T>(current: RunSession, read: ConditionalRead<T>) {
            try {
                const answer = await read.load(read.etag);
                if (!isCurrent(current)) {
                    return;
                }

                switch (answer.status) {
                    case 304:
                        read.state.value = {
                            ...read.state.value,
                            status: 'ready',
                            httpStatus: null,
                            checkedAt: clock.now(),
                        };
                        break;
                    case 200:
                        read.etag = answer.etag;
                        read.state.value = {
                            value: answer.value,
                            status: 'ready',
                            httpStatus: null,
                            checkedAt: clock.now(),
                        };
                        break;
                    case 'gone':
                        read.etag = undefined;
                        read.state.value = { ...read.state.value, status: 'gone', httpStatus: null };
                        break;
                }
            } catch (error) {
                if (isCurrent(current)) {
                    logger.warn('Could not read a workflow run', { error });
                    putNotRead(read, getHttpStatus(error));
                }
            } finally {
                read.reading = false;
            }
        }

        function askLog(params: LogParams) {
            const { state } = params;
            if (getAllowancePause(rateLimits.get('core'), clock.now())) {
                state.value = { status: 'failed', httpStatus: null };
                return;
            }

            state.value = LOADING;
            void readLog(params);
        }

        async function readLog({ current, state, nameWithOwner, jobId, steps }: LogParams) {
            try {
                const answer = await readJobLog(current.rest, { nameWithOwner, jobId });
                if (isCurrent(current)) {
                    state.value =
                        answer.status === 200
                            ? { status: 'ready', log: parseJobLog(answer.text, steps) }
                            : { status: 'gone' };
                }
            } catch (error) {
                if (isCurrent(current)) {
                    logger.warn('Could not read a job’s log', { error });
                    state.value =
                        error instanceof JobLogRefusal
                            ? { status: error.reason }
                            : { status: 'failed', httpStatus: getHttpStatus(error) };
                }
            }
        }

        /** Unless a newer re-run of the run took its place. */
        function dropRerun({ current, key, layer }: DropRerunParams) {
            if (current.reruns.value.get(key) === layer) {
                const next = new Map(current.reruns.value);
                next.delete(key);
                current.reruns.value = next;
            }
        }

        function isCurrent(current: RunSession) {
            return sessionRef.value === current && accounts.isCurrent(current.account);
        }
    },
});

/** The re-run's attempt, finished: GitHub's word is all there is to say, whatever the jobs' read says. */
function hasFinishedAgain(run: GitHubWorkflowRunDetail, layer: RunRerun) {
    return run.status === 'completed' && run.runAttempt > layer.attempt;
}

/** The run as running, unless GitHub's read of it shows the re-run itself. */
function withRerun(run: GitHubWorkflowRunDetail, layer: RunRerun): GitHubWorkflowRunDetail {
    if (run.status !== 'completed' || hasFinishedAgain(run, layer)) {
        return run;
    }

    return {
        ...run,
        status: 'in_progress',
        conclusion: null,
        runStartedAt: layer.startedAt,
        updatedAt: layer.startedAt,
        runAttempt: run.runAttempt + 1,
    };
}

/** The jobs re-run as running from the start, those GitHub's read still has finished as they were. */
function withRerunJobs(jobs: readonly GitHubWorkflowJob[], layer: RunRerun): readonly GitHubWorkflowJob[] {
    return jobs.map(job =>
        layer.jobs.has(job.id) && job.status === 'completed' && job.completedAt === layer.jobs.get(job.id)
            ? {
                  ...job,
                  status: 'in_progress',
                  conclusion: null,
                  startedAt: layer.startedAt,
                  completedAt: null,
                  steps: job.steps.map(step => ({
                      ...step,
                      status: 'queued',
                      conclusion: null,
                      startedAt: null,
                      completedAt: null,
                  })),
              }
            : job,
    );
}

/** A read that did not happen: what is known stays as it was; with nothing known, it says so. */
function putNotRead<T>(read: ConditionalRead<T>, httpStatus: number | null) {
    const { value, status } = read.state.value;
    if (value === null || status !== 'ready') {
        read.state.value = { ...read.state.value, status: 'failed', httpStatus };
    }
}

function getHttpStatus(error: unknown) {
    return error instanceof GitHubApiError ? error.status : null;
}

function findStoredRun(stored: RepositoryWorkflows | undefined, runId: number): GitHubWorkflowRunDetail | null {
    for (const { workflow, runs } of stored?.workflows ?? []) {
        const run = runs.find(candidate => candidate.id === runId);
        if (run) {
            return { ...run, workflowName: workflow.name, headCommitMessage: null };
        }
    }

    return null;
}

function getRunTarget(run: GitHubWorkflowRunDetail): WorkflowActionTarget {
    return { kind: 'run', runId: run.id, workflowName: run.workflowName, runNumber: run.runNumber };
}

function getKey(nameWithOwner: string, id: number) {
    return JSON.stringify([nameWithOwner, id]);
}
