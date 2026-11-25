import type { ReviewRow } from '../buildReviewRows.js';
import { listCursorStops } from './listCursorStops.js';
import type { IsThreadWhole } from './listCursorStops.js';
import type { ReviewCursor } from './ReviewCursor.js';

export interface NormalizeCursorParams {
    /** The row `cursor.key` names. */
    readonly row: ReviewRow;
    readonly cursor: ReviewCursor;
    readonly isThreadWhole: IsThreadWhole;
    /** The thread's comment ids as they were, for a comment gone to give way to the next one left, else the previous. */
    readonly previousComments?: readonly string[];
    /** A key move came into the thread from below: its last comment, not its first. */
    readonly fromBelow?: boolean;
}

/**
 * The cursor made a stop of its row (D44): a thread shown whole without a comment of its own on its first comment (its last
 * when entered from below), one whose comment went on the next comment left, else the previous; a folded thread, or any
 * other row, on its bare key. The cursor itself while it already is a stop, for whoever compares it to one kept.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function normalizeCursor({
    row,
    cursor,
    isThreadWhole,
    previousComments,
    fromBelow = false,
}: NormalizeCursorParams): ReviewCursor {
    const stops = listCursorStops(row, isThreadWhole);
    if (stops.every(stop => stop.comment === undefined)) {
        return cursor.comment === undefined ? cursor : { key: cursor.key };
    }

    if (stops.some(stop => stop.comment === cursor.comment)) {
        return cursor;
    }

    const { comment } = cursor;
    if (comment !== undefined && previousComments) {
        const gone = previousComments.indexOf(comment);
        const after = gone === -1 ? [] : previousComments.slice(gone + 1);
        const before = gone === -1 ? [] : previousComments.slice(0, gone).toReversed();
        for (const id of [...after, ...before]) {
            const stop = stops.find(other => other.comment === id);
            if (stop) {
                return stop;
            }
        }
    }

    return (fromBelow ? stops.at(-1) : stops[0]) ?? { key: cursor.key };
}
