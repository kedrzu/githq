import { GitHubApiError } from '../GitHubApiError.js';

/**
 * Whether an error is GitHub saying the thing is no longer there: 404, or 410 — which of them a run or a log past its
 * retention answers is not documented. A result for the caller to tell, not a failure to retry.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isGitHubGone(error: unknown): boolean {
    return error instanceof GitHubApiError && (error.status === 404 || error.status === 410);
}
