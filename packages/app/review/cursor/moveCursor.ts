import type { ReviewRow } from '../buildReviewRows.js';
import { isCursorStop } from './isCursorStop.js';
import type { ReviewCursor } from './ReviewCursor.js';

export interface MoveCursorParams {
    readonly rows: readonly ReviewRow[];
    readonly cursor: ReviewCursor;
    /** How many stops, down if positive: more than one for a held key ({@link getCursorStep}) or a page. */
    readonly delta: number;
}

/**
 * The cursor moved by so many stops (D44), passing over rows that are not; at either end of the diff it stays on the
 * last stop it reached. A cursor whose row is not among the rows stays where it is: nothing says where it was.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function moveCursor({ rows, cursor, delta }: MoveCursorParams): ReviewCursor {
    const start = rows.findIndex(row => row.key === cursor.key);
    if (start === -1) {
        return cursor;
    }

    const step = Math.sign(delta);
    let left = Math.abs(delta);
    let reached = cursor;
    for (let index = start + step; left > 0 && index >= 0 && index < rows.length; index += step) {
        const row = rows[index];
        if (row && isCursorStop(row)) {
            reached = { key: row.key };
            left--;
        }
    }

    return reached;
}
