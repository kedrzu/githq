import { GitHubApiError } from '@githq/github/GitHubApiError.js';

import { isRateLimitRefusal } from '../isRateLimitRefusal.js';

/**
 * A failure that concerns the one target a loop polled — a tracked repository or project: GitHub answering it with an
 * error status other than the allowance's and a revoked token's, which concern every target and fail the loop.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isTargetFailure(error: unknown): error is GitHubApiError {
    return error instanceof GitHubApiError && !isRateLimitRefusal(error) && error.status !== 401;
}
