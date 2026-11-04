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

/** A page of a workflow's runs asks for this many: a screenful of lines. */
const HISTORY_PAGE_SIZE = 30;

/** Whose runs: one workflow's, on every ref or on one. */
export interface WorkflowRunHistoryQuery {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly workflowId: number;
    /** Only the runs on this exact branch or tag; every ref's when `null`. */
    readonly ref: string | null;
}

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
 * A workflow's older runs, read from GitHub on demand (actions D12) — the first page anew each time a repository's
 * Workflows tab unfolds the workflow, the next ones as it reaches the end of its runs (W3b) — on any ref or on one,
 * nothing asked while the core allowance is used up. Held in memory for the signed-in user only, never kept on disk nor
 * merged into the workflows' store: the sync's runs stay what decides a workflow's state.
 */
export type WorkflowRunHistory = Resolved<typeof WorkflowRunHistory>;
export const WorkflowRunHistory = defineService({
    name: 'WorkflowRunHistory',
    deps: {
        accounts: AccountSession,
        createRest: GitHubRestFactory,
        rateLimits: GitHubRateLimitStore,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, createRest, rateLimits, clock, logger }) {
        const entriesRef = shallowRef<ReadonlyMap<string, HistoryEntry>>(new Map());
        let session: HistorySession | null = null;

        accounts.onChange(account => {
            entriesRef.value = new Map();
            session = account ? { account, rest: createRest(() => account.token) } : null;
        });

        return { get, refresh, readMore };

        /** What was read of the workflow's runs; nothing before the first page is asked. Reactive. */
        function get(query: WorkflowRunHistoryQuery): WorkflowRunHistoryState {
            return entriesRef.value.get(getKey(query)) ?? UNREAD;
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
 * the next unfold asks again; a page the user waits for says it was not read, asking again asks it again.
 */
function getNotRead({ entry, anew }: ReadParams): HistoryEntry {
    return anew && (entry.runs.length > 0 || entry.complete) ? entry : { ...entry, status: 'failed' };
}

function getKey({ nameWithOwner, workflowId, ref }: WorkflowRunHistoryQuery) {
    return JSON.stringify([nameWithOwner, workflowId, ref]);
}
