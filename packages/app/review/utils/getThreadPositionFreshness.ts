import type { Freshness } from '@/sync/Freshness.js';

/** Where a focused thread is, as the status bar says it. */
export type ThreadPositionFreshness = Extract<Freshness, { kind: 'threadPosition' }>;

/**
 * What the status bar says with a thread focused (CR15): where it is, over a review that is only up to date or on its way.
 * Anything that warns goes on being said.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getThreadPositionFreshness(freshness: Freshness, position: ThreadPositionFreshness): Freshness {
    switch (freshness.kind) {
        case 'fresh':
        case 'partial':
        case 'fetchingFiles':
            return position;
        default:
            return freshness;
    }
}
