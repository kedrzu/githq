import type { GitHubApiError } from '@githq/github/GitHubApiError.js';

/**
 * GitHub refusing for the rate: a secondary limit (403/429 with `retry-after`), a primary one over REST
 * (403/429, "rate limit" in the message) or over GraphQL (`RATE_LIMITED`, often with a 200).
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isRateLimitRefusal(error: GitHubApiError) {
    if (error.errors.some(entry => entry.type === 'RATE_LIMITED')) {
        return true;
    }

    return (
        (error.status === 403 || error.status === 429) &&
        (error.retryAfter != null || /rate limit/i.test(error.message))
    );
}
