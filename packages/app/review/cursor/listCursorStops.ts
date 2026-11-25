import type { ReviewRow, ReviewThreadRow } from '../buildReviewRows.js';
import { isCursorStop } from './isCursorStop.js';
import type { ReviewCursor } from './ReviewCursor.js';

/** Whether a thread shows whole, its comments each a stop: the view's, by `isReviewThreadWhole`. */
export type IsThreadWhole = (row: ReviewThreadRow) => boolean;

/**
 * The cursor's stops on a row, in reading order (D44): one per comment of a thread shown whole, the row itself for any other
 * stop, none for a row the cursor passes over. A whole thread with no comment left is the row itself.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function listCursorStops(row: ReviewRow, isThreadWhole: IsThreadWhole): ReviewCursor[] {
    if (!isCursorStop(row)) {
        return [];
    }

    const comments = row.kind === 'thread' && isThreadWhole(row) ? row.placement.thread.comments : [];
    return comments.length > 0 ? comments.map(comment => ({ key: row.key, comment: comment.id })) : [{ key: row.key }];
}
