import { listWorkflowRuns } from '@githq/github/rest/listWorkflowRuns.js';
import type { GitHubRestRequester } from '@githq/github/rest/createGitHubRestRequester.js';
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { GitHubRestFactory } from '@/services/GitHubRestFactory.js';

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

const UNREAD: HistoryEntry = { runs: [], status: 'idle', complete: false, nextPageUrl: null };

/**
 * A workflow's older runs, read from GitHub on demand (actions D12) — a page at a time as a repository's Workflows tab
 * unfolds the workflow and reaches the end of its runs (W3b) — on any ref or on one. Held in memory for the signed-in
 * user only, never kept on disk nor merged into the workflows' store: the sync's runs stay what decides a workflow's
 * state.
 */
export type WorkflowRunHistory = Resolved<typeof WorkflowRunHistory>;
export const WorkflowRunHistory = defineService({
    name: 'WorkflowRunHistory',
    deps: {
        accounts: AccountSession,
        createRest: GitHubRestFactory,
        logger: Logger,
    },
    setup({ accounts, createRest, logger }) {
        const entriesRef = shallowRef<ReadonlyMap<string, HistoryEntry>>(new Map());
        let session: HistorySession | null = null;

        accounts.onChange(account => {
            entriesRef.value = new Map();
            session = account ? { account, rest: createRest(() => account.token) } : null;
        });

        return { get, ensure, readMore };

        /** What was read of the workflow's runs; nothing before the first page is asked. Reactive. */
        function get(query: WorkflowRunHistoryQuery): WorkflowRunHistoryState {
            return entriesRef.value.get(getKey(query)) ?? UNREAD;
        }

        /** Reads the first page, unless it was read or is being read. */
        function ensure(query: WorkflowRunHistoryQuery) {
            const entry = get(query);
            if (entry.runs.length === 0 && !entry.complete && entry.status === 'idle') {
                readMore(query);
            }
        }

        /** Reads the next page — or the one that failed, again; nothing while one is read or once every page is. */
        function readMore(query: WorkflowRunHistoryQuery) {
            const current = session;
            const key = getKey(query);
            const entry = entriesRef.value.get(key) ?? UNREAD;
            if (!current || entry.status === 'reading' || entry.complete) {
                return;
            }

            put(key, { ...entry, status: 'reading' });
            void read(current, key, entry, query);
        }

        async function read(current: HistorySession, key: string, entry: HistoryEntry, query: WorkflowRunHistoryQuery) {
            try {
                const page = await listWorkflowRuns(current.rest, {
                    nameWithOwner: query.nameWithOwner,
                    workflowId: query.workflowId,
                    branch: query.ref ?? undefined,
                    perPage: HISTORY_PAGE_SIZE,
                    pageUrl: entry.nextPageUrl ?? undefined,
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
                put(key, {
                    runs: [...entry.runs, ...page.runs.filter(run => !known.has(run.id))],
                    status: 'idle',
                    complete: page.nextPageUrl === undefined,
                    nextPageUrl: page.nextPageUrl ?? null,
                });
            } catch (error) {
                if (isCurrent(current)) {
                    logger.warn('Could not read a workflow’s runs', { error });
                    put(key, { ...entry, status: 'failed' });
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

function getKey({ nameWithOwner, workflowId, ref }: WorkflowRunHistoryQuery) {
    return JSON.stringify([nameWithOwner, workflowId, ref]);
}
