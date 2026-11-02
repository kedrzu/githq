import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';

import type { WorkflowRefSettings } from '../WorkflowTypes.js';
import { matchRefPattern } from './matchRefPattern.js';

/** The refs that count in a repository. */
export interface IsRunCountedParams extends WorkflowRefSettings {
    /** The branch GitHub calls the default one; `null` while unknown, when it counts nothing. */
    readonly defaultBranch: string | null;
}

/**
 * Whether a run lights the counters (actions D1, D5): one started by a pull request never does, whatever its ref;
 * any other on the default branch, while it counts, or on a ref matching a pattern (D13) does.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isRunCounted(run: GitHubWorkflowRun, params: IsRunCountedParams): boolean {
    const ref = run.headBranch;
    if (ref === null || run.event.startsWith('pull_request')) {
        return false;
    }

    if (params.countDefaultBranch && ref === params.defaultBranch) {
        return true;
    }

    return params.patterns.some(pattern => matchRefPattern(pattern, ref));
}
