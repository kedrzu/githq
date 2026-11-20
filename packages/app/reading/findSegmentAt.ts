import type { ReadingSegment } from './ReadingCursor.js';

/**
 * The segment holding a position, from the content's top; above the first, the first, and below the last, the last, so
 * a band reaching past the content's ends still finds one. `null` with no segments.
 *
 * @param segments As `buildSegments` gives them: in order, without a break.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function findSegmentAt(segments: readonly ReadingSegment[], y: number): ReadingSegment | null {
    return segments.find(segment => y < segment.end) ?? segments.at(-1) ?? null;
}
