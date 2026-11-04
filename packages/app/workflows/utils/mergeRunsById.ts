import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';

import { sortRunsByCreation } from './sortRunsByCreation.js';

/**
 * The runs of every list merged by id, the newest first by creation time. Where a run is in several, the copy in the
 * later list wins: the caller orders the lists by which copy it trusts most.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function mergeRunsById(lists: readonly (readonly GitHubWorkflowRun[])[]): GitHubWorkflowRun[] {
    const byId = new Map<number, GitHubWorkflowRun>();
    for (const list of lists) {
        for (const run of list) {
            byId.set(run.id, run);
        }
    }

    return sortRunsByCreation([...byId.values()]).toReversed();
}
