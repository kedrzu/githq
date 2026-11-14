import { listWorkflowRuns } from '@githq/github/rest/listWorkflowRuns.js';
import type { GitHubRestRequester } from '@githq/github/rest/createGitHubRestRequester.js';
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { Clock } from '@/services/Clock.js';
import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { GitHubRestFactory } from '@/services/GitHubRestFactory.js';
import { getAllowancePause } from '@/sync/getAllowancePause.js';

import { mergeRunsById } from './utils/mergeRunsById.js';
import { WorkflowStore } from './WorkflowStore.js';

/** A page of a workflow's runs asks for this many: a screenful of lines. */
const HISTORY_PAGE_SIZE = 30;

/** Which workflow's runs. */
export interface WorkflowRunsTarget {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly workflowId: number;
}

/** Which of a workflow's runs, by exact values GitHub filters on; `null` for any. */
export interface WorkflowRunFilters {
    /** Only the runs on this exact branch or tag. */
    readonly ref: string | null;
    /** Only the runs this event started: `push`, `pull_request`, `schedule`, … */
    readonly event: string | null;
    /** Only the runs in this status or with this conclusion (`in_progress`, `failure`, …) — GitHub takes either. */
    readonly status: string | null;
    /** Only the runs credited to this login. */
    readonly actor: string | null;
}

/** Every run: no filter set. */
export const NO_WORKFLOW_RUN_FILTERS: WorkflowRunFilters = { ref: null, event: null, status: null, actor: null };

/** Whose runs: one workflow's, every one of them or those the filters let through. */
interface WorkflowRunHistoryQuery extends WorkflowRunsTarget, WorkflowRunFilters {}

/** Whether a workflow's older runs are being read; `failed`: the last page asked was not read, asking again asks it again. */
export type WorkflowRunHistoryStatus = 'idle' | 'reading' | 'failed';

/** What was read of a workflow's runs, page after page. */
export interface WorkflowRunHistoryState {
    /** The runs read, the newest first. */
    readonly runs: readonly GitHubWorkflowRun[];
    readonly status: WorkflowRunHistoryStatus;
    /** Every page was read: there is nothing older. */
    readonly complete: boolean;
}

/** The runs of the workflow open as an item, under the filters set there. */
export interface WorkflowRunsBrowse extends WorkflowRunHistoryState {
    readonly filters: WorkflowRunFilters;
    /**
     * Nothing was read yet under these filters: {@link runs} are those the sync keeps of the workflow that the filters
     * let through, shown until the first page replaces them.
     */
    readonly seeded: boolean;
}

/** The workflow open as an item, and the filters set on its runs. */
interface Browsed {
    readonly target: WorkflowRunsTarget;
    readonly filters: WorkflowRunFilters;
}

interface HistoryEntry extends WorkflowRunHistoryState {
    /** The page after the last one read; `null` before the first page is read. */
    readonly nextPageUrl: string | null;
}

/** The signed-in user the runs are read for, and the requester sending their token. */
interface HistorySession {
    readonly account: Account;
    readonly rest: GitHubRestRequester;
}

/** What reading a page goes on from. */
interface ReadParams {
    /** The session it was asked in: an answer arriving after it ended is dropped. */
    readonly current: HistorySession;
    readonly key: string;
    /** The entry as it stood when asked. */
    readonly entry: HistoryEntry;
    readonly query: WorkflowRunHistoryQuery;
    /** The first page is read anew, over what is known, rather than the next one. */
    readonly anew: boolean;
}

const UNREAD: HistoryEntry = { runs: [], status: 'idle', complete: false, nextPageUrl: null };

/**
 * A workflow's older runs, read from GitHub on demand (actions D12) — the first page anew each time the workflow opens
 * as an item or its filters change, the next ones as the list reaches the end of its runs — every run or those the
 * filters let through, nothing asked while the core allowance is used up. Held
 * in memory for the signed-in user only, never kept on disk nor merged into the workflows' store: the sync's runs stay
 * what decides a workflow's state.
 *
 * The workflow open as an item ({@link open}) has filters of its own, cleared when another workflow opens; its runs
 * show at once from those the sync keeps, until the first page read replaces them.
 */
export type WorkflowRunHistory = Resolved<typeof WorkflowRunHistory>;
export const WorkflowRunHistory = defineService({
    name: 'WorkflowRunHistory',
    deps: {
        accounts: AccountSession,
        createRest: GitHubRestFactory,
        rateLimits: GitHubRateLimitStore,
        workflows: WorkflowStore,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, createRest, rateLimits, workflows, clock, logger }) {
        const entriesRef = shallowRef<ReadonlyMap<string, HistoryEntry>>(new Map());
        const browsedRef = shallowRef<Browsed | null>(null);
        let session: HistorySession | null = null;

        accounts.onChange(account => {
            entriesRef.value = new Map();
            browsedRef.value = null;
            session = account ? { account, rest: createRest(account.getToken) } : null;
        });

        return { open, getRuns, setFilters, readMoreRuns };

        /**
         * Opens the workflow as an item: its filters are cleared when another workflow was open, kept when it was this
         * one, and the first page under them is read anew.
         */
        function open(target: WorkflowRunsTarget) {
            const browsed = browsedRef.value;
            if (!browsed || !isSameTarget(browsed.target, target)) {
                browsedRef.value = { target, filters: NO_WORKFLOW_RUN_FILTERS };
            }

            refresh({ ...target, ...getFilters(target) });
        }

        /** The filters set on the workflow's runs, and the first page under them read anew. */
        function setFilters(target: WorkflowRunsTarget, filters: WorkflowRunFilters) {
            browsedRef.value = { target, filters };
            refresh({ ...target, ...filters });
        }

        /** Reads the next page of the workflow's runs under its filters. */
        function readMoreRuns(target: WorkflowRunsTarget) {
            readMore({ ...target, ...getFilters(target) });
        }

        /**
         * The workflow's runs under its filters — no filter unless it is the one open — and, while nothing was read
         * under them, those the sync keeps that they let through. Reactive.
         */
        function getRuns(target: WorkflowRunsTarget): WorkflowRunsBrowse {
            const filters = getFilters(target);
            const entry = entriesRef.value.get(getKey({ ...target, ...filters })) ?? UNREAD;
            if (entry.runs.length > 0 || entry.complete) {
                return { runs: entry.runs, status: entry.status, complete: entry.complete, filters, seeded: false };
            }

            const stored = workflows
                .get(target.nameWithOwner)
                ?.workflows.find(candidate => candidate.workflow.id === target.workflowId);
            const runs = (stored?.runs ?? []).filter(run => isRunFiltered(run, filters));
            return { runs, status: entry.status, complete: false, filters, seeded: runs.length > 0 };
        }

        function getFilters(target: WorkflowRunsTarget): WorkflowRunFilters {
            const browsed = browsedRef.value;
            return browsed && isSameTarget(browsed.target, target) ? browsed.filters : NO_WORKFLOW_RUN_FILTERS;
        }

        /**
         * Reads the first page anew, what is known staying meanwhile: new runs join on top, those read again are told as
         * they are now. Nothing while a page is being read.
         */
        function refresh(query: WorkflowRunHistoryQuery) {
            const key = getKey(query);
            const entry = entriesRef.value.get(key) ?? UNREAD;
            if (session && entry.status !== 'reading') {
                ask({ current: session, key, entry, query, anew: true });
            }
        }

        /** Reads the next page — or the one that failed, again; nothing while one is read or once every page is. */
        function readMore(query: WorkflowRunHistoryQuery) {
            const key = getKey(query);
            const entry = entriesRef.value.get(key) ?? UNREAD;
            if (session && entry.status !== 'reading' && !entry.complete) {
                ask({ current: session, key, entry, query, anew: false });
            }
        }

        function ask(params: ReadParams) {
            const { key, entry } = params;
            if (getAllowancePause(rateLimits.get('core'), clock.now())) {
                put(key, getNotRead(params));
                return;
            }

            put(key, { ...entry, status: 'reading' });
            void read(params);
        }

        async function read(params: ReadParams) {
            const { current, key, entry, query, anew } = params;
            const first = anew || entry.nextPageUrl === null;
            try {
                const page = await listWorkflowRuns(current.rest, {
                    nameWithOwner: query.nameWithOwner,
                    workflowId: query.workflowId,
                    branch: query.ref ?? undefined,
                    event: query.event ?? undefined,
                    status: query.status ?? undefined,
                    actor: query.actor ?? undefined,
                    perPage: HISTORY_PAGE_SIZE,
                    pageUrl: first ? undefined : (entry.nextPageUrl ?? undefined),
                });
                if (!isCurrent(current)) {
                    return;
                }

                // No ETag is sent, so GitHub never answers 304; were it to, nothing changed.
                if (page.status === 304) {
                    put(key, { ...entry, status: 'idle' });
                    return;
                }

                const known = new Set(entry.runs.map(run => run.id));
                // A first page reaching what is known joins it, and paging goes on where it was: new runs only push
                // older ones to later pages, read twice at worst. One that does not reach it leaves a gap: it starts over.
                if (first && page.runs.some(run => known.has(run.id))) {
                    put(key, { ...entry, runs: mergeRunsById([entry.runs, page.runs]), status: 'idle' });
                    return;
                }

                put(key, {
                    runs: first ? page.runs : mergeRunsById([entry.runs, page.runs]),
                    status: 'idle',
                    complete: page.nextPageUrl === undefined,
                    nextPageUrl: page.nextPageUrl ?? null,
                });
            } catch (error) {
                if (isCurrent(current)) {
                    logger.warn('Could not read a workflow’s runs', { error });
                    put(key, getNotRead(params));
                }
            }
        }

        function put(key: string, entry: HistoryEntry) {
            entriesRef.value = new Map(entriesRef.value).set(key, entry);
        }

        function isCurrent(current: HistorySession) {
            return session?.account === current.account && accounts.isCurrent(current.account);
        }
    },
});

/**
 * The entry after a read that did not happen. Reading anew over what is known is only a check: it stays as it was, and
 * the next opening asks again; a page the user waits for says it was not read, asking again asks it again.
 */
function getNotRead({ entry, anew }: ReadParams): HistoryEntry {
    return anew && (entry.runs.length > 0 || entry.complete) ? entry : { ...entry, status: 'failed' };
}

function getKey({ nameWithOwner, workflowId, ref, event, status, actor }: WorkflowRunHistoryQuery) {
    return JSON.stringify([nameWithOwner, workflowId, ref, event, status, actor]);
}

function isSameTarget(a: WorkflowRunsTarget, b: WorkflowRunsTarget) {
    return a.nameWithOwner === b.nameWithOwner && a.workflowId === b.workflowId;
}

/** Whether GitHub would list the run under the filters: each, when set, matches exactly. */
function isRunFiltered(run: GitHubWorkflowRun, filters: WorkflowRunFilters) {
    return (
        (filters.ref === null || run.headBranch === filters.ref) &&
        (filters.event === null || run.event === filters.event) &&
        (filters.status === null || run.status === filters.status || run.conclusion === filters.status) &&
        (filters.actor === null || run.actor?.login === filters.actor)
    );
}
