import { findStopOnScreen } from './findStopOnScreen.js';
import type { ReadingBand, ReadingCursor, ReadingStopBox } from './ReadingCursor.js';

export interface FollowScrollParams {
    /** In document order. */
    readonly stops: readonly ReadingStopBox[];
    readonly cursor: ReadingCursor;
    /** What shows after the scroll. */
    readonly band: ReadingBand;
    /** Which way the content was scrolled. */
    readonly direction: 'down' | 'up';
}

/**
 * Where a wheel, trackpad or scrollbar scroll leaves the reading cursor (D44): on its stop while any of it shows; once
 * the stop is wholly out of sight, on the stop at the edge it left by (the top scrolling down, the bottom up), so the
 * keys always act on something in view. Its stop gone, the same.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function followScroll({ stops, cursor, band, direction }: FollowScrollParams): ReadingCursor {
    const stop = stops.find(other => other.key === cursor.key);
    if (stop && stop.bottom > band.top && stop.top < band.bottom) {
        return cursor;
    }

    return findStopOnScreen({ stops, band, edge: direction === 'down' ? 'top' : 'bottom' }) ?? cursor;
}
