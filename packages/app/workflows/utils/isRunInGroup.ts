import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';

import type { WorkflowRefGroup } from '../WorkflowTypes.js';
import { matchRefPattern } from './matchRefPattern.js';

/**
 * Whether a run counts in a group (actions D1, D5): one started by a pull request never does, whatever its ref — the
 * run's event decides, not its ref; any other on the group's default branch, or on a ref its pattern matches (D13),
 * does.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isRunInGroup(run: GitHubWorkflowRun, group: WorkflowRefGroup): boolean {
    const ref = run.headBranch;
    if (ref === null || run.event.startsWith('pull_request')) {
        return false;
    }

    return group.kind === 'defaultBranch' ? ref === group.branch : matchRefPattern(group.pattern, ref);
}
