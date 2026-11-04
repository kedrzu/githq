import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';

/**
 * Whether a pull request started a run (actions D1), by its event — `pull_request`, `pull_request_target`, … — since
 * its ref alone cannot tell. `issue_comment` counts as one: GitHub runs it on the default branch whatever the comment
 * is on, and comments on pull requests are what bots such as CLA run on.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isPullRequestRun(run: GitHubWorkflowRun): boolean {
    return run.event === 'issue_comment' || run.event.startsWith('pull_request');
}
