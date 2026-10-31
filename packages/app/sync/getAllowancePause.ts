import type { GitHubRateLimit } from '@githq/github/GitHubRateLimit.js';

import type { SyncPause } from './SyncPausedError.js';

/**
 * What refresh leaves of the GraphQL allowance for the user's own edits and the reads they need (an item's
 * detail, a repository's labels): it pauses when only this much is left (K3), so editing still works until the
 * reset. Edits go through GraphQL only; nothing is kept back of the other buckets.
 */
export const EDIT_RESERVE = 100;

/**
 * The pause a background read — a sync loop, a saved view's answer — waits out instead of drawing on the bucket
 * `limit` reports, used up but for what is kept for edits ({@link EDIT_RESERVE}); `null` when it may ask. `now` is
 * epoch ms.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getAllowancePause(limit: GitHubRateLimit | null, now: number): SyncPause | null {
    if (!limit || limit.resetAt.getTime() <= now) {
        return null;
    }

    const reserve = limit.resource === 'graphql' ? EDIT_RESERVE : 0;
    return limit.remaining <= reserve ? { until: limit.resetAt.getTime(), bucket: limit.resource } : null;
}
