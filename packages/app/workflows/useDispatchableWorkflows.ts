import type { GitHubWorkflow } from '@githq/github/rest/listWorkflows.js';
import type { GitHubWorkflowFileParse, WorkflowInput } from '@githq/github/workflows/parseWorkflowFile.js';
import { readRepositoryWorkflowFiles } from '@githq/github/workflows/readRepositoryWorkflowFiles.js';
import { useLogger } from '@nzyme/vue-ioc/useLogger.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { shallowRef, watch } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { Clock } from '@/services/Clock.js';
import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { getAllowancePause } from '@/sync/getAllowancePause.js';

import { WorkflowStore } from './WorkflowStore.js';

/** A workflow the user may run by hand, and what it asks for. */
export interface DispatchableWorkflow {
    readonly workflow: GitHubWorkflow;
    /** Its file at the default branch, which has `workflow_dispatch`. */
    readonly parse: GitHubWorkflowFileParse;
    readonly inputs: readonly WorkflowInput[];
}

/** A repository's workflows that can be run by hand, as far as they were read. */
export interface DispatchableWorkflows {
    readonly status: 'unread' | 'reading' | 'read' | 'failed';
    /** Its enabled workflows whose file at the default branch has `workflow_dispatch`, in GitHub's order. */
    readonly workflows: readonly DispatchableWorkflow[];
    /** Its enabled workflows, whether or not they can be run by hand: "3 of 8". */
    readonly total: number;
}

/** What was read of a repository's workflow files. */
interface FilesEntry {
    readonly status: 'reading' | 'read' | 'failed';
    readonly files: ReadonlyMap<string, GitHubWorkflowFileParse>;
    /** Epoch ms the last read was asked. */
    readonly askedAt: number;
}

/** What {@link useDispatchableWorkflows} gives. */
export interface DispatchableWorkflowsReader {
    /** What is known of the repository's workflows to run; reactive. */
    get(nameWithOwner: string): DispatchableWorkflows;
    /** Reads the repository's workflow files, unless they are being read or were a moment ago. */
    read(nameWithOwner: string): void;
}

/** One visit of a menu asks once for a repository's files, however often its steps open. */
const FRESH_MS = 60_000;

const EMPTY = new Map<string, GitHubWorkflowFileParse>();

/**
 * Which workflows of a repository the user can run by hand (W46, W36): its workflow files at the default branch, read in
 * one request (`readRepositoryWorkflowFiles`) only when asked — as the step listing them opens —, against the workflows
 * the sync keeps of it. Kept while the component lives, for the account signed in.
 */
export function useDispatchableWorkflows(): DispatchableWorkflowsReader {
    const accounts = useService(AccountSession);
    const workflows = useService(WorkflowStore);
    const rateLimits = useService(GitHubRateLimitStore);
    const clock = useService(Clock);
    const logger = useLogger();
    const entries = shallowRef<ReadonlyMap<string, FilesEntry>>(new Map());

    watch(
        () => accounts.current,
        () => {
            entries.value = new Map();
        },
    );

    return { get, read };

    function get(nameWithOwner: string): DispatchableWorkflows {
        const entry = entries.value.get(nameWithOwner);
        const stored = workflows.get(nameWithOwner)?.workflows ?? [];
        const files = entry?.files ?? EMPTY;
        const found: DispatchableWorkflow[] = [];
        for (const { workflow } of stored) {
            const parse = files.get(workflow.path);
            if (workflow.state === 'active' && parse?.kind === 'parsed' && parse.file.dispatch) {
                found.push({ workflow, parse, inputs: parse.file.dispatch.inputs });
            }
        }

        const total = stored.filter(({ workflow }) => workflow.state === 'active').length;
        return { status: entry?.status ?? 'unread', workflows: found, total };
    }

    function read(nameWithOwner: string) {
        const account = accounts.current;
        const entry = entries.value.get(nameWithOwner);
        const now = clock.now();
        if (!account || entry?.status === 'reading' || (entry?.status === 'read' && now - entry.askedAt < FRESH_MS)) {
            return;
        }

        const files = entry?.files ?? EMPTY;
        if (getAllowancePause(rateLimits.get('graphql'), now)) {
            put(nameWithOwner, { status: 'failed', files, askedAt: now });
            return;
        }

        put(nameWithOwner, { status: 'reading', files, askedAt: now });
        void ask(account, nameWithOwner, now);
    }

    async function ask(account: Account, nameWithOwner: string, askedAt: number) {
        try {
            const files = await readRepositoryWorkflowFiles(account.sdk, { nameWithOwner });
            if (accounts.isCurrent(account)) {
                put(nameWithOwner, { status: 'read', files, askedAt });
            }
        } catch (error) {
            if (accounts.isCurrent(account)) {
                logger.warn('Could not read a repository’s workflow files', { error });
                put(nameWithOwner, {
                    status: 'failed',
                    files: entries.value.get(nameWithOwner)?.files ?? EMPTY,
                    askedAt,
                });
            }
        }
    }

    function put(nameWithOwner: string, entry: FilesEntry) {
        entries.value = new Map(entries.value).set(nameWithOwner, entry);
    }
}
