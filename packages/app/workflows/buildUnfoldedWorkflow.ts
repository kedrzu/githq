import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';

import { getRefKind } from './utils/getRefKind.js';
import { sortRunsByCreation } from './utils/sortRunsByCreation.js';
import type { WorkflowRunHistoryState, WorkflowRunHistoryStatus } from './WorkflowRunHistory.js';
import type { RepositoryWorkflows, WorkflowRowRef } from './WorkflowTypes.js';

/** One run of an unfolded workflow, as its line shows it. */
export interface UnfoldedRun {
    /** Unique among the tab's rows: `run:<id>`. */
    readonly key: string;
    readonly run: GitHubWorkflowRun;
    /** The ref it ran on, with its kind; `null` when GitHub names none. */
    readonly ref: WorkflowRowRef | null;
}

/** A workflow unfolded in its repository's Workflows tab (actions W3b): its runs, on any ref or on one. */
export interface UnfoldedWorkflow {
    /** The workflow's row's key. */
    readonly key: string;
    /** The newest first: the ones kept, then the ones read on demand, on {@link ref} only while it is set. */
    readonly runs: readonly UnfoldedRun[];
    /** The refs its runs were seen on, the most recent first — the filter's choices; the filter's own among them. */
    readonly refs: readonly string[];
    /** The ref the runs are filtered by; `null`: every ref. */
    readonly ref: string | null;
    /** Whether older runs are being read, or the last read failed. */
    readonly status: WorkflowRunHistoryStatus;
    /** No older run is left to read. */
    readonly complete: boolean;
}

/** What {@link buildUnfoldedWorkflow} lists. */
export interface BuildUnfoldedWorkflowParams {
    readonly stored: RepositoryWorkflows;
    readonly workflowId: number;
    /** The ref to list the runs of; `null` for every ref. */
    readonly ref: string | null;
    /** What was read on demand of the runs on {@link ref}. */
    readonly history: WorkflowRunHistoryState;
    /** What was read on demand of its runs on every ref: the refs they ran on are offered too. */
    readonly anyRef: readonly GitHubWorkflowRun[];
}

/**
 * A workflow's runs as its unfolded row lists them (actions W3b): the runs the store keeps show at once, those read on
 * demand below them, merged by id — the store's copy wins, the sync keeps it current — the newest first, those on the
 * filter's ref alone while it is set. Runs a pull request started are listed like any other.
 * @__NO_SIDE_EFFECTS__
 */
export function buildUnfoldedWorkflow(params: BuildUnfoldedWorkflowParams): UnfoldedWorkflow {
    const { stored, workflowId, ref, history, anyRef } = params;
    const kept = stored.workflows.find(entry => entry.workflow.id === workflowId)?.runs ?? [];
    const runs = mergeRuns([kept, history.runs]).filter(run => ref === null || run.headBranch === ref);
    const seen = mergeRuns([kept, anyRef, history.runs]);

    const refNames = new Set<string>();
    for (const run of seen) {
        if (run.headBranch !== null) {
            refNames.add(run.headBranch);
        }
    }

    if (ref !== null) {
        refNames.add(ref);
    }

    return {
        key: `${workflowId}`,
        runs: runs.map(run => ({ key: `run:${run.id}`, run, ref: toRef(run.headBranch) })),
        refs: [...refNames],
        ref,
        status: history.status,
        complete: history.complete,
    };

    function toRef(name: string | null): WorkflowRowRef | null {
        return name === null ? null : { name, kind: getRefKind(stored, name) };
    }
}

/** The runs of every list, merged by id — an earlier list's copy wins —, the newest first. */
function mergeRuns(lists: readonly (readonly GitHubWorkflowRun[])[]) {
    const byId = new Map<number, GitHubWorkflowRun>();
    for (const list of lists) {
        for (const run of list) {
            if (!byId.has(run.id)) {
                byId.set(run.id, run);
            }
        }
    }

    return sortRunsByCreation([...byId.values()]).toReversed();
}
