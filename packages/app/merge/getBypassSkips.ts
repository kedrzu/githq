import { getPullRequestStanding } from '@/store/getPullRequestStanding.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';

import { isHoldingCheck } from './isHoldingCheck.js';
import type { MergeCheck } from './MergeTypes.js';

/** What a merge past the rules skips: GitHub says only whether the viewer may, so the panel lists it (merging D12). */
export interface BypassSkips {
    /** The required checks failing or still running. */
    readonly checks: readonly MergeCheck[];
    readonly review: 'changesRequested' | 'required' | null;
    /** The branch has to be up to date, and is behind. */
    readonly behind: boolean;
    /** GitHub says it is blocked, and nothing above says why. */
    readonly other: boolean;
}

/**
 * Every requirement of the merge not met, as far as the status and the checks read tell (PM12a).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getBypassSkips(pr: PullRequestItem, checks: readonly MergeCheck[]): BypassSkips {
    const held = checks.filter(isHoldingCheck);
    const standing = getPullRequestStanding(pr);
    const behind = pr.mergeStateStatus === 'BEHIND';
    let review: BypassSkips['review'] = null;
    if (standing.changesRequested) {
        review = 'changesRequested';
    } else if (standing.waitingForReview) {
        review = 'required';
    }

    const other = pr.mergeStateStatus === 'BLOCKED' && held.length === 0 && review === null;
    return { checks: held, review, behind, other };
}
