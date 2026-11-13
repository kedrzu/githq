import { assertNever } from '@nzyme/utils/assertNever.js';

import type { ReviewRow } from '../buildReviewRows.js';

/**
 * Whether the line cursor can stop on a row (D44): a file's header, a row of code, a thread or a gap. Everything else is
 * passed over: placeholders and notes belong to their header, a comment box has its own focus, and distance marks, a
 * submodule's block, a file's end and the all-viewed block hold nothing to act on. A collapsed file is thereby its header
 * and the threads under it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isCursorStop(row: ReviewRow): boolean {
    switch (row.kind) {
        case 'header':
        case 'line':
        case 'thread':
        case 'gap':
            return true;
        case 'allViewed':
        case 'comment':
        case 'distance':
        case 'end':
        case 'failed':
        case 'fileEnd':
        case 'notice':
        case 'onlyWhitespace':
        case 'paused':
        case 'placeholder':
        case 'submodule':
            return false;
        default:
            return assertNever(row);
    }
}
