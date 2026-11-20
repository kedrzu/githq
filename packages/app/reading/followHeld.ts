import { findSegmentAt } from './findSegmentAt.js';
import type { ReadingSegment } from './ReadingCursor.js';

export interface FollowHeldParams {
    /** As `buildSegments` gives them. */
    readonly segments: readonly ReadingSegment[];
    /** The reading line the held key carries through the content, from the content's top (`getHeldLine` to start). */
    readonly line: number;
    readonly direction: 'down' | 'up';
    /** The cursor's segment before the line moved. */
    readonly current: ReadingSegment;
}

/**
 * Where a held ↓ ↑ leaves the reading cursor as the screen scrolls smoothly: on the segment holding the reading line,
 * but never back against the way it goes (a re-layout or the line's start can put the line on a segment the cursor has
 * passed), so going down it never returns to a segment before `current`, nor up to one after it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function followHeld({ segments, line, direction, current }: FollowHeldParams): ReadingSegment {
    const found = findSegmentAt(segments, line);
    if (!found) {
        return current;
    }

    const isBack = direction === 'down' ? found.start < current.start : found.start > current.start;
    return isBack ? current : found;
}
