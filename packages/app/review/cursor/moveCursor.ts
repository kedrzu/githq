import type { ReviewRow } from '../buildReviewRows.js';
import type { IsThreadWhole } from './listCursorStops.js';
import type { ReviewCursor } from './ReviewCursor.js';
import { walkCursorStops } from './walkCursorStops.js';

export interface MoveCursorParams {
    readonly rows: readonly ReviewRow[];
    readonly cursor: ReviewCursor;
    /** How many stops, down if positive: more than one for a held key ({@link getHeldStep}) or a page. */
    readonly delta: number;
    readonly isThreadWhole: IsThreadWhole;
}

/**
 * The cursor moved by so many stops (D44), passing over rows that are not; at either end of the diff it stays on the
 * last stop it reached. A thread shown whole is a stop per comment, in reading order: going up into it lands on its last.
 * A cursor whose row is not among the rows stays where it is: nothing says where it was.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function moveCursor({ rows, cursor, delta, isThreadWhole }: MoveCursorParams): ReviewCursor {
    let left = Math.abs(delta);
    let reached = cursor;
    if (left === 0) {
        return reached;
    }

    for (const { stop } of walkCursorStops({ rows, cursor, direction: delta > 0 ? 1 : -1, isThreadWhole })) {
        reached = stop;
        left--;
        if (left === 0) {
            break;
        }
    }

    return reached;
}
