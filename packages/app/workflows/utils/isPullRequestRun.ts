import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';

/**
 * Whether a pull request started a run (actions D1), by its event — `pull_request`, `pull_request_target`, … — since
 * its ref alone cannot tell.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isPullRequestRun(run: GitHubWorkflowRun): boolean {
    return run.event.startsWith('pull_request');
}
