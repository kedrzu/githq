import type { Freshness } from '@/sync/Freshness.js';

/** Where the reader is, as the status bar says it: not how fresh the review is. */
export type ReviewPlaceFreshness = Extract<Freshness, { kind: 'threadPosition' | 'landing' }>;

/**
 * What the status bar says with a place to tell of, a thread focused (CR15) or where the review just opened (CR20, CR25,
 * CR26): that, over a review that is only up to date or on its way. Anything that warns goes on being said.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getReviewPlaceFreshness(freshness: Freshness, place: ReviewPlaceFreshness): Freshness {
    switch (freshness.kind) {
        case 'fresh':
        case 'partial':
        case 'fetchingFiles':
            return place;
        default:
            return freshness;
    }
}
