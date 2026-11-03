import type { ReviewThreadPlacements } from '../useReviewRows.js';

/** The threads a review started, as its summary in the conversation speaks of them. */
export interface ReviewOwnThreads {
    readonly ids: ReadonlySet<string>;
    /** Every one of them is resolved. */
    readonly resolved: boolean;
    /**
     * The files showing them, in no particular order. Empty when none shows anywhere: resolved ones on a file gone from the
     * diff have no entry to land on (D12).
     */
    readonly paths: readonly string[];
}

/**
 * What each review started, by the review's id: a thread is its first comment's review's, a reply being a review of its
 * own that started nothing.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getReviewOwnThreads({ byFile, goneEntries }: ReviewThreadPlacements): Map<string, ReviewOwnThreads> {
    const gone = new Set(goneEntries);
    const collected = new Map<string, { ids: Set<string>; resolved: boolean; paths: Set<string> }>();
    for (const [path, placements] of byFile) {
        for (const { kind, thread } of placements) {
            const reviewId = thread.comments[0]?.pullRequestReview?.id;
            if (reviewId === undefined) {
                continue;
            }

            const own = collected.get(reviewId) ?? { ids: new Set(), resolved: true, paths: new Set() };
            collected.set(reviewId, own);
            own.ids.add(thread.id);
            own.resolved &&= thread.isResolved;
            if (kind !== 'gone' || gone.has(path)) {
                own.paths.add(path);
            }
        }
    }

    return new Map(
        [...collected].map(([reviewId, own]) => [
            reviewId,
            { ids: own.ids, resolved: own.resolved, paths: [...own.paths] },
        ]),
    );
}
