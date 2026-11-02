import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';

import type { WorkflowRefGroup } from '../WorkflowTypes.js';
import { getRunVerdict } from './getRunVerdict.js';
import { isRunInGroup } from './isRunInGroup.js';
import { mergeRunsById } from './mergeRunsById.js';

/** How many runs a workflow keeps: a strip shows 5, and the break's start is told from the runs since the last pass. */
export const WORKFLOW_RUNS_KEPT = 20;

/** What {@link mergeWorkflowRuns} merges. */
export interface MergeWorkflowRunsParams {
    /** The runs kept so far. */
    readonly stored: readonly GitHubWorkflowRun[];
    /** The runs just read; where a run is in both, this copy wins — its status may have moved. */
    readonly read: readonly GitHubWorkflowRun[];
    /** The counted groups, so the run that decides each (actions D1) is never cut off. */
    readonly groups: readonly WorkflowRefGroup[];
}

/**
 * A workflow's runs after a read: the kept and the read ones merged by id, the newest first by creation time, cut to
 * the latest {@link WORKFLOW_RUNS_KEPT} plus each group's latest run with a verdict, so neither a row of cancelled runs
 * nor a busy ref elsewhere can cut off the failure that keeps a group broken (actions D1). What lies between goes: a
 * break whose start is cut off with it says so ("3h+"), and no group's state changes.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function mergeWorkflowRuns(params: MergeWorkflowRunsParams): GitHubWorkflowRun[] {
    const runs = mergeRunsById([params.stored, params.read]);
    const decidingIds = new Set<number>();
    for (const group of params.groups) {
        const deciding = runs.find(run => getRunVerdict(run) !== null && isRunInGroup(run, group));
        if (deciding) {
            decidingIds.add(deciding.id);
        }
    }

    return runs.filter((run, index) => index < WORKFLOW_RUNS_KEPT || decidingIds.has(run.id));
}
