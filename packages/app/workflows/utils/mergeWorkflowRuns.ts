import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';

import { getRunVerdict } from './getRunVerdict.js';
import { isRunCounted } from './isRunCounted.js';
import type { IsRunCountedParams } from './isRunCounted.js';
import { sortRunsByCreation } from './sortRunsByCreation.js';

/** How many runs a workflow keeps: a strip shows 5, and the break's start is told from the runs since the last pass. */
export const WORKFLOW_RUNS_KEPT = 20;

/** What {@link mergeWorkflowRuns} merges. */
export interface MergeWorkflowRunsParams {
    /** The runs kept so far. */
    readonly stored: readonly GitHubWorkflowRun[];
    /** The runs just read; where a run is in both, this copy wins — its status may have moved. */
    readonly read: readonly GitHubWorkflowRun[];
    /** The refs that count, so the run that decides the workflow (actions D1) is never cut off. */
    readonly counted: IsRunCountedParams;
}

/**
 * A workflow's runs after a read: the kept and the read ones merged by id, the newest first by creation time, cut to
 * the latest {@link WORKFLOW_RUNS_KEPT} — or further back, to the latest counted run with a verdict, so a row of
 * cancelled runs cannot cut off the failure that keeps the workflow broken (actions D1).
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function mergeWorkflowRuns(params: MergeWorkflowRunsParams): GitHubWorkflowRun[] {
    const byId = new Map<number, GitHubWorkflowRun>();
    for (const run of params.stored) {
        byId.set(run.id, run);
    }

    for (const run of params.read) {
        byId.set(run.id, run);
    }

    const runs = sortRunsByCreation([...byId.values()]).toReversed();
    const decisive = runs.findIndex(run => getRunVerdict(run) !== null && isRunCounted(run, params.counted));
    return runs.slice(0, Math.max(WORKFLOW_RUNS_KEPT, decisive + 1));
}
