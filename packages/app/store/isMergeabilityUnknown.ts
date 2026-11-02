import type { PullRequestStatus } from './ItemTypes.js';

/**
 * GitHub has not worked out yet whether the pull request merges (merging PM22): it computes that in the background,
 * after a push or once the base branch moved, and says "unknown" meanwhile. A draft just marked ready still holds the
 * draft's status until GitHub reads it again: not known either.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isMergeabilityUnknown(
    pr: Pick<PullRequestStatus, 'isDraft' | 'mergeable' | 'mergeStateStatus'>,
): boolean {
    return (
        pr.mergeable === 'UNKNOWN' ||
        pr.mergeStateStatus === 'UNKNOWN' ||
        (pr.mergeStateStatus === 'DRAFT' && !pr.isDraft)
    );
}
