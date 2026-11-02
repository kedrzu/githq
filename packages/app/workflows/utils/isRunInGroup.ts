import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';

import type { WorkflowRefGroup } from '../WorkflowTypes.js';
import { isPullRequestRun } from './isPullRequestRun.js';
import { isRefInGroup } from './isRefInGroup.js';

/**
 * Whether a run counts in a group (actions D1, D5): one started by a pull request never does, whatever its ref — the
 * run's event decides, not its ref; any other on the group's default branch, or on a ref its pattern matches (D13),
 * does.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isRunInGroup(run: GitHubWorkflowRun, group: WorkflowRefGroup): boolean {
    return run.headBranch !== null && !isPullRequestRun(run) && isRefInGroup(run.headBranch, group);
}
