import type { Item, PullRequestItem } from '@/store/ItemTypes.js';

/** A pull request with the viewer's draft review. */
type PullRequestWithDraft = PullRequestItem & {
    readonly pendingReview: NonNullable<PullRequestItem['pendingReview']>;
};

/**
 * The pull requests of the local copy with the viewer's draft review, the one waiting longest first (CR34). Closed or
 * merged ones too: the draft is still there, its comments unsent. Those outside the copy can't be found (D21).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getDraftReviews(items: readonly Item[]): PullRequestWithDraft[] {
    return items
        .filter((item): item is PullRequestWithDraft => item.kind === 'pullRequest' && item.pendingReview !== null)
        .toSorted((a, b) => Date.parse(a.pendingReview.createdAt) - Date.parse(b.pendingReview.createdAt));
}
