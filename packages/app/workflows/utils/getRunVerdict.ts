import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';

import type { RunVerdict } from '../WorkflowTypes.js';

/**
 * What a run says of its workflow (actions D1): `failure`, `timed_out` and `startup_failure` failed, `success`
 * passed; any other conclusion — cancelled, skipped, neutral, action_required, stale, none yet, or one GitHub adds
 * later — says nothing, so it can neither break nor heal a workflow.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getRunVerdict(run: GitHubWorkflowRun): RunVerdict | null {
    switch (run.conclusion) {
        case 'failure':
        case 'timed_out':
        case 'startup_failure':
            return 'failed';
        case 'success':
            return 'passed';
        default:
            return null;
    }
}
