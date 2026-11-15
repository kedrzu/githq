import type { GitHubRestRequester } from '@githq/github/rest/createGitHubRestRequester.js';
import { readWorkflowFile } from '@githq/github/rest/readWorkflowFile.js';
import type { GitHubWorkflowFileParse } from '@githq/github/workflows/parseWorkflowFile.js';
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

/** Which workflow file, at which ref. */
export interface WorkflowFileTarget {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    /** As the workflow's `path` gives it (`.github/workflows/deploy.yml`). */
    readonly path: string;
    /** A branch, tag or commit; the repository's default branch when `null`. */
    readonly ref: string | null;
}

/** What was read of a workflow file. */
export interface WorkflowFileRead {
    /** The file as last read — kept while it is read again; `null` before the first read. */
    readonly parse: GitHubWorkflowFileParse | null;
    /** `failed`: the last read did not happen; reading again asks again. */
    readonly status: 'idle' | 'reading' | 'failed';
}

interface FileEntry extends WorkflowFileRead {
    /** The ETag of the last 200, sent with the next read; `null` when none came. */
    readonly etag: string | null;
}

/** The signed-in user the files are read for, and the requester sending their token. */
interface FileSession {
    readonly account: Account;
    readonly rest: GitHubRestRequester;
}

const UNREAD: FileEntry = { parse: null, status: 'idle', etag: null };

/**
 * Workflow files read from GitHub when a screen needs one (the workflow's details, the dispatch form) — never in the
 * background — and kept in memory for the signed-in user's session. Each read is conditional: an unchanged file is a
 * free 304 and keeps its parse. Nothing is asked while the core allowance is used up.
 */
export type WorkflowFileStore = Resolved<typeof WorkflowFileStore>;
export const WorkflowFileStore = defineService({
    name: 'WorkflowFileStore',
    deps: {
        accounts: AccountSession,
        createRest: GitHubRestFactory,
        rateLimits: GitHubRateLimitStore,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, createRest, rateLimits, clock, logger }) {
        const entriesRef = shallowRef<ReadonlyMap<string, FileEntry>>(new Map());
        let session: FileSession | null = null;

        accounts.onChange(account => {
            entriesRef.value = new Map();
            session = account ? { account, rest: createRest(account.getToken) } : null;
        });

        return { get, read };

        /** What was read of the file; nothing before {@link read} is first called. Reactive. */
        function get(target: WorkflowFileTarget): WorkflowFileRead {
            const { parse, status } = entriesRef.value.get(getKey(target)) ?? UNREAD;
            return { parse, status };
        }

        /** Reads the file — again, conditionally, when it was read before; nothing while it is being read. */
        function read(target: WorkflowFileTarget) {
            const current = session;
            const key = getKey(target);
            const entry = entriesRef.value.get(key) ?? UNREAD;
            if (!current || entry.status === 'reading') {
                return;
            }

            if (getAllowancePause(rateLimits.get('core'), clock.now())) {
                put(key, { ...entry, status: 'failed' });
                return;
            }

            put(key, { ...entry, status: 'reading' });
            void ask(current, key, target, entry);
        }

        async function ask(current: FileSession, key: string, target: WorkflowFileTarget, entry: FileEntry) {
            try {
                const answer = await readWorkflowFile(current.rest, {
                    nameWithOwner: target.nameWithOwner,
                    path: target.path,
                    ref: target.ref ?? undefined,
                    etag: entry.etag ?? undefined,
                });
                if (!isCurrent(current)) {
                    return;
                }

                put(
                    key,
                    answer.status === 304
                        ? { ...entry, status: 'idle' }
                        : { parse: answer.workflow, status: 'idle', etag: answer.etag ?? null },
                );
            } catch (error) {
                if (isCurrent(current)) {
                    logger.warn('Could not read a workflow file', { error });
                    put(key, { ...entry, status: 'failed' });
                }
            }
        }

        function put(key: string, entry: FileEntry) {
            entriesRef.value = new Map(entriesRef.value).set(key, entry);
        }

        function isCurrent(current: FileSession) {
            return session?.account === current.account && accounts.isCurrent(current.account);
        }
    },
});

function getKey({ nameWithOwner, path, ref }: WorkflowFileTarget) {
    return JSON.stringify([nameWithOwner, path, ref]);
}
