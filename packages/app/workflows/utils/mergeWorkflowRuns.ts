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
 * the latest {@link WORKFLOW_RUNS_KEPT} — or further back, to the oldest of the groups' latest runs with a verdict, so
 * neither a row of cancelled runs nor a busy ref elsewhere can cut off the failure that keeps a group broken (actions
 * D1).
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function mergeWorkflowRuns(params: MergeWorkflowRunsParams): GitHubWorkflowRun[] {
    const runs = mergeRunsById([params.stored, params.read]);
    let kept = WORKFLOW_RUNS_KEPT;
    for (const group of params.groups) {
        const deciding = runs.findIndex(run => getRunVerdict(run) !== null && isRunInGroup(run, group));
        kept = Math.max(kept, deciding + 1);
    }

    return runs.slice(0, kept);
}
