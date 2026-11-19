import { assertValue } from '@nzyme/utils/assert.js';

import type { ReadingPlace, ReadingSegment, ReadingStopBox } from './ReadingCursor.js';

export interface GetSegmentCursorParams {
    /** Holding the segment's stop. */
    readonly stops: readonly ReadingStopBox[];
    readonly segment: ReadingSegment;
    /** Where on the segment, from the content's top, kept inside it. Default its start. */
    readonly y?: number;
}

/**
 * The reading cursor's place on a segment: its stop's key and the offset that `findCursorSegment` finds it by again.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getSegmentCursor({ stops, segment, y = segment.start }: GetSegmentCursorParams): ReadingPlace {
    const stop = assertValue(stops.find(other => other.key === segment.key));
    const at = Math.min(Math.max(y, segment.start), segment.end - 1);
    return { key: segment.key, offset: at - stop.top };
}
