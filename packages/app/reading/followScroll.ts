import { findCursorSegment } from './findCursorSegment.js';
import { findSegmentAt } from './findSegmentAt.js';
import { getSegmentCursor } from './getSegmentCursor.js';
import type { ReadingBand, ReadingPlace, ReadingSegment, ReadingStopBox } from './ReadingCursor.js';

export interface FollowScrollParams {
    /** As `buildSegments` gives them from `stops`. */
    readonly segments: readonly ReadingSegment[];
    /** In document order. */
    readonly stops: readonly ReadingStopBox[];
    readonly cursor: ReadingPlace;
    /** What shows after the scroll. */
    readonly band: ReadingBand;
    /** Which way the content was scrolled. */
    readonly direction: 'down' | 'up';
}

/**
 * Where a wheel, trackpad or scrollbar scroll leaves the reading cursor (D44): on its segment while any of it shows;
 * once the segment is wholly out of sight, on the segment at the edge it left by (the top scrolling down, the bottom
 * up), so the keys always act on something in view. Its stop gone, the same. A segment taller than what shows is taken
 * where the band starts, so the cursor stays on the part in sight.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function followScroll({ segments, stops, cursor, band, direction }: FollowScrollParams): ReadingPlace {
    const current = findCursorSegment({ segments, stops, cursor });
    if (current && current.end > band.top && current.start < band.bottom) {
        return cursor;
    }

    const edge = findSegmentAt(segments, direction === 'down' ? band.top : band.bottom - 1);
    return edge ? getSegmentCursor({ stops, segment: edge, y: band.top }) : cursor;
}
