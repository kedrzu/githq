import type { ReviewRow } from '../buildReviewRows.js';
import { listCursorStops } from './listCursorStops.js';
import type { IsThreadWhole } from './listCursorStops.js';
import type { ReviewCursor } from './ReviewCursor.js';

export interface WalkCursorStopsParams {
    readonly rows: readonly ReviewRow[];
    readonly cursor: ReviewCursor;
    /** Down if 1. */
    readonly direction: 1 | -1;
    readonly isThreadWhole: IsThreadWhole;
}

/** A stop the cursor passes on its way, and the row it is on. */
export interface WalkedCursorStop {
    readonly row: ReviewRow;
    readonly stop: ReviewCursor;
}

/**
 * The stops from the cursor that way, in reading order (D44), the cursor's own left out: first the comments of its own
 * thread still that way, then those of the rows after it, a whole thread's last first going up. None when the cursor's row
 * is not among the rows.
 */
export function* walkCursorStops({
    rows,
    cursor,
    direction,
    isThreadWhole,
}: WalkCursorStopsParams): Generator<WalkedCursorStop> {
    const start = rows.findIndex(row => row.key === cursor.key);
    const row = rows[start];
    if (!row) {
        return;
    }

    // None on a row the cursor is no stop of.
    const own = listCursorStops(row, isThreadWhole);
    const at = own.findIndex(stop => stop.comment === cursor.comment);
    const ahead = at === -1 ? [] : direction === 1 ? own.slice(at + 1) : own.slice(0, at).toReversed();
    for (const stop of ahead) {
        yield { row, stop };
    }

    for (const other of direction === 1 ? rows.slice(start + 1) : rows.slice(0, start).toReversed()) {
        const stops = listCursorStops(other, isThreadWhole);
        for (const stop of direction === 1 ? stops : stops.toReversed()) {
            yield { row: other, stop };
        }
    }
}
