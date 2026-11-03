import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import type { GitHubRateLimit } from '@githq/github/GitHubRateLimit.js';

import { isRateLimitRefusal } from './isRateLimitRefusal.js';
import type { SyncPause } from './SyncPausedError.js';

/** How long to wait on a rate-limit refusal that says neither when to retry nor which bucket ran out. */
const UNKNOWN_PAUSE_MS = 60_000;

/** What {@link getRefusalPause} tells a refusal by. */
export interface GetRefusalPauseParams {
    /** What the request failed with. */
    readonly error: unknown;
    /** The allowance last reported of each bucket the request draws on, `null` for one not reported yet. */
    readonly limits: readonly (GitHubRateLimit | null)[];
    /** Epoch ms. */
    readonly now: number;
}

/**
 * The pause a failed request calls for when GitHub refused it for the rate: as long as GitHub asks (`retry-after`),
 * else until a used-up bucket resets, else a minute. `null` for any other failure.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getRefusalPause({ error, limits, now }: GetRefusalPauseParams): SyncPause | null {
    if (!(error instanceof GitHubApiError) || !isRateLimitRefusal(error)) {
        return null;
    }

    if (error.retryAfter != null) {
        return { until: now + error.retryAfter * 1000, bucket: null };
    }

    for (const limit of limits) {
        if (limit && limit.remaining === 0 && limit.resetAt.getTime() > now) {
            return { until: limit.resetAt.getTime(), bucket: limit.resource };
        }
    }

    return { until: now + UNKNOWN_PAUSE_MS, bucket: null };
}
