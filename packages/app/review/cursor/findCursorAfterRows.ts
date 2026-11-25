import { assertNever } from '@nzyme/utils/assertNever.js';

import { findReplacementRow, getCommentLine, getReviewHeaderKey, getReviewRowPath } from '../buildReviewRows.js';
import type { ReviewGapDirection, ReviewGapRow, ReviewRow } from '../buildReviewRows.js';
import { isCursorStop } from './isCursorStop.js';
import type { IsThreadWhole } from './listCursorStops.js';
import { normalizeCursor } from './normalizeCursor.js';
import type { ReviewCursor } from './ReviewCursor.js';

export interface FindCursorAfterRowsParams {
    readonly previous: readonly ReviewRow[];
    readonly next: readonly ReviewRow[];
    readonly cursor: ReviewCursor;
    /** Every file in the order they show, those not shown too ({@link findReplacementRow}). */
    readonly order?: readonly string[];
    /** The way lines came out of a gap, when that is what changed the rows; `null` for anything else. */
    readonly expanded?: ReviewGapDirection | null;
    readonly isThreadWhole: IsThreadWhole;
}

/**
 * Where the cursor is once the rows change (D44): on its row while that is there. A gap it is on keeps it while lines
 * stay hidden there, though lines coming down from its top move its key; opened whole, the cursor goes to the line that
 * came out first, which the way they came says. Any other row gone gives way to the row of the same line in the new rows
 * (a layout or whitespace switch), or else the nearest stop left, in its file first ({@link findReplacementRow}): a
 * placeholder or a note standing for its file's content gives its header, a comment box, a mark or a file's end the next
 * stop of their file. A thread shown whole keeps the cursor on its comment, or with that gone on the next comment left, else
 * the previous; folded, on the thread. The cursor itself while it is still a stop. `null` when no file is left.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findCursorAfterRows({
    previous,
    next,
    cursor,
    order,
    expanded,
    isThreadWhole,
}: FindCursorAfterRowsParams): ReviewCursor | null {
    const held = previous.find(row => row.key === cursor.key);
    const kept = next.find(row => row.key === cursor.key);
    if (kept) {
        const previousComments =
            held?.kind === 'thread' ? held.placement.thread.comments.map(comment => comment.id) : undefined;
        return normalizeCursor({ row: kept, cursor, isThreadWhole, previousComments });
    }

    const gapRow = held?.kind === 'gap' ? findGapAfterRows(next, held, expanded ?? null) : null;
    if (gapRow) {
        return { key: gapRow.key };
    }

    const replacement = findReplacementRow({ key: cursor.key, offset: 0, previous, next, order });
    const stop = replacement && snapToStop(next, replacement.row);
    return stop && normalizeCursor({ row: stop, cursor: { key: stop.key }, isThreadWhole });
}

/**
 * The gap again, by its file and where it ends, which lines coming down from its top leave as they were; or opened whole,
 * the line that came out first. `null` when neither is shown, or which line came first is not known.
 */
function findGapAfterRows(rows: readonly ReviewRow[], gap: ReviewGapRow, expanded: ReviewGapDirection | null) {
    const fileRows = getFileRows(rows, getReviewRowPath(gap.key));
    const { afterStart, afterEnd } = gap.range;
    const same = fileRows.find(row => row.kind === 'gap' && row.range.afterEnd === afterEnd);
    if (same || !expanded) {
        return same ?? null;
    }

    const first = expanded === 'down' ? afterStart + 1 : afterEnd;
    return (
        fileRows.find(row => {
            const line = getCommentLine(row);
            return line?.side === 'after' && line.line === first;
        }) ?? null
    );
}

/** The stop for a row that is not one: its file's header for what stands in for the file's content, else the next one. */
function snapToStop(rows: readonly ReviewRow[], row: ReviewRow): ReviewRow | null {
    const path = getReviewRowPath(row.key);
    const header = rows.find(other => other.key === getReviewHeaderKey(path)) ?? null;
    switch (row.kind) {
        case 'header':
        case 'line':
        case 'thread':
        case 'gap':
            return row;
        case 'failed':
        case 'notice':
        case 'onlyWhitespace':
        case 'paused':
        case 'placeholder':
        case 'submodule':
            return header;
        case 'allViewed':
        case 'comment':
        case 'distance':
        case 'end':
        case 'fileEnd':
            return getFileRows(rows.slice(rows.indexOf(row)), path).find(isCursorStop) ?? header;
        default:
            return assertNever(row);
    }
}

/** The rows of a file from where `rows` start, up to the next file's header: its own header too if `rows` start there. */
function getFileRows(rows: readonly ReviewRow[], path: string) {
    const start = rows.findIndex(row => getReviewRowPath(row.key) === path);
    if (start === -1) {
        return [];
    }

    const end = rows.findIndex((row, index) => index > start && row.kind === 'header');
    return rows.slice(start, end === -1 ? undefined : end);
}
