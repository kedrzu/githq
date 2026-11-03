import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import type { GitHubRestRequester } from '@githq/github/rest/createGitHubRestRequester.js';
import { getWorkflowRun } from '@githq/github/rest/getWorkflowRun.js';
import type { GitHubWorkflowRunDetail } from '@githq/github/rest/getWorkflowRun.js';
import { listRunJobs } from '@githq/github/rest/listRunJobs.js';
import type { GitHubWorkflowJob, GitHubWorkflowStep } from '@githq/github/rest/listRunJobs.js';
import { readJobLog } from '@githq/github/rest/readJobLog.js';
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

import { parseJobLog } from './utils/parseJobLog.js';
import type { ParsedJobLog } from './utils/parseJobLog.js';
import { WorkflowStore } from './WorkflowStore.js';
import type { RepositoryWorkflows } from './WorkflowTypes.js';

/** How many logs stay in memory: reading one costs little, keeping many costs a lot (actions D12). */
const KEPT_LOGS = 5;

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
      };

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

const LOADING: WorkflowLogState = { status: 'loading' };

/**
 * A run, its jobs and its jobs' logs, read from GitHub when a failure is opened (actions D3, D12) and only then, nothing
 * asked while the core allowance is used up. Held in memory for the signed-in user only, never on disk: a few logs at a
 * time, the least recently asked dropping out.
 *
 * Each `get…` starts the read the first time it is asked, so it may be called from a `computed`: what it writes is its
 * own new state, which nothing watches yet.
 */
export type WorkflowRunStore = Resolved<typeof WorkflowRunStore>;
export const WorkflowRunStore = defineService({
    name: 'WorkflowRunStore',
    deps: {
        accounts: AccountSession,
        workflows: WorkflowStore,
        createRest: GitHubRestFactory,
        rateLimits: GitHubRateLimitStore,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, workflows, createRest, rateLimits, clock, logger }) {
        const sessionRef = shallowRef<RunSession | null>(null);
        const pageFreshnessRef = shallowRef<Freshness | null>(null);

        accounts.onChange(account => {
            sessionRef.value = account
                ? {
                      account,
                      rest: createRest(() => account.token),
                      runs: new Map(),
                      jobs: new Map(),
                      logs: createLruCache({ maxSize: KEPT_LOGS }),
                  }
                : null;
        });

        return {
            /** What the run's page shown says in the status bar instead of the workflows' poll (W4e, W4i, W4j); `null` if nothing. */
            get pageFreshness() {
                return pageFreshnessRef.value;
            },
            setPageFreshness,
            getRun,
            getJobs,
            refresh,
            getLog,
            retry,
        };

        function setPageFreshness(freshness: Freshness | null) {
            pageFreshnessRef.value = freshness;
        }

        /** The run as the sync stored it, at once, then as read. Reactive. */
        function getRun(nameWithOwner: string, runId: number): WorkflowRunState {
            const stored = findStoredRun(workflows.get(nameWithOwner), runId);
            const current = sessionRef.value;
            if (!current) {
                return { run: stored, status: 'loading', httpStatus: null };
            }

            const { value, status, httpStatus } = openRun({ current, nameWithOwner, runId }).state.value;
            return { run: value ?? stored, status, httpStatus };
        }

        /** The run's jobs, none until read. Reactive. */
        function getJobs(nameWithOwner: string, runId: number): WorkflowJobsState {
            const current = sessionRef.value;
            if (!current) {
                return { jobs: [], status: 'loading', httpStatus: null, checkedAt: null };
            }

            const { value, status, httpStatus, checkedAt } = openJobs({ current, nameWithOwner, runId }).state.value;
            return { jobs: value ?? [], status, httpStatus, checkedAt };
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
                    state.value = { status: 'failed', httpStatus: getHttpStatus(error) };
                }
            }
        }

        function isCurrent(current: RunSession) {
            return sessionRef.value === current && accounts.isCurrent(current.account);
        }
    },
});

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
            return { ...run, workflowName: workflow.name, headCommitMessage: null, runAttempt: null };
        }
    }

    return null;
}

function getKey(nameWithOwner: string, id: number) {
    return JSON.stringify([nameWithOwner, id]);
}
