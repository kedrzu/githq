import type { ReadingPlace, ReadingSegment, ReadingStopBox } from './ReadingCursor.js';

export interface FindCursorSegmentParams {
    readonly segments: readonly ReadingSegment[];
    readonly stops: readonly ReadingStopBox[];
    readonly cursor: ReadingPlace;
}

/**
 * The segment the reading cursor is on: among its stop's own, the one holding `stop.top + offset`, else the one
 * starting nearest it. Never the segment found at that position whatever its stop (`findStopAt`): content growing
 * inside the stop (a reply sent, a comment loading) moves its later segments down past the offset, and the cursor
 * must stay on its stop, on the segment it was. `null` with its stop gone.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function findCursorSegment({ segments, stops, cursor }: FindCursorSegmentParams): ReadingSegment | null {
    const stop = stops.find(other => other.key === cursor.key);
    if (!stop) {
        return null;
    }

    const y = stop.top + cursor.offset;
    let nearest: ReadingSegment | null = null;
    for (const segment of segments) {
        if (segment.key !== cursor.key) {
            continue;
        }

        if (segment.start <= y && y < segment.end) {
            return segment;
        }

        if (nearest === null || Math.abs(segment.start - y) < Math.abs(nearest.start - y)) {
            nearest = segment;
        }
    }

    return nearest;
}
