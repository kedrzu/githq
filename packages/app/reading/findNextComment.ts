import type { ReadingStopBox } from './ReadingCursor.js';

export interface FindNextCommentParams {
    /** In document order. */
    readonly stops: readonly ReadingStopBox[];
    /** The stop to step from. */
    readonly key: string;
    readonly direction: 1 | -1;
}

/**
 * The comment after or before a stop in document order (`[` `]`), passing over every other row: a comment nested in a
 * review comes right after the review. `null` at the ends, or with the stop not there.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findNextComment({ stops, key, direction }: FindNextCommentParams): ReadingStopBox | null {
    const from = stops.findIndex(stop => stop.key === key);
    if (from === -1) {
        return null;
    }

    for (let index = from + direction; index >= 0 && index < stops.length; index += direction) {
        const stop = stops[index];
        if (stop?.kind === 'comment') {
            return stop;
        }
    }

    return null;
}
