import { assert } from '@nzyme/utils/assert.js';

import { getReviewRowPath } from '../buildReviewRows.js';
import type { ReviewRow } from '../buildReviewRows.js';
import type { DiffLineSide } from '../diff/buildDiffRows.js';
import type { FindLine } from './findDiffMatches.js';

/** A line of code shown in the review, as find searches it. */
export interface ReviewFindLine extends FindLine {
    /** The row it is drawn in: what a step jumps to and what looks its marks up. */
    readonly key: string;
    readonly path: string;
    readonly side: DiffLineSide;
    /** 1-based, on its side. */
    readonly line: number;
}

/**
 * The lines find searches, in the rows' order, a split row's left half before its right. Only rows of code: a gap's
 * hidden lines, a placeholder's bars and everything else are not searched. Each line of the diff is counted once, so
 * both layouts count the same: a removed line on its older side, an added or unchanged one on its newer side. The left
 * half of a split unchanged row is the newer side's twin, so it is marked but not counted, nor stepped to.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function collectFindLines(rows: readonly ReviewRow[]): ReviewFindLine[] {
    const lines: ReviewFindLine[] = [];
    for (const row of rows) {
        if (row.kind !== 'line') {
            continue;
        }

        const { key, line, diff } = row;
        const path = getReviewRowPath(key);
        if (line.layout === 'split') {
            if (line.left) {
                const text = diff.before[line.left.line - 1] ?? '';
                lines.push({
                    key,
                    path,
                    side: 'before',
                    line: line.left.line,
                    text,
                    counted: line.left.kind === 'deleted',
                });
            }

            if (line.right) {
                const text = diff.after[line.right.line - 1] ?? '';
                lines.push({ key, path, side: 'after', line: line.right.line, text, counted: true });
            }
        } else if (line.sign === '-') {
            assert(line.oldLine, 'A removed line has an older line number');
            const text = diff.before[line.oldLine - 1] ?? '';
            lines.push({ key, path, side: 'before', line: line.oldLine, text, counted: true });
        } else {
            // An unchanged row shows the newer text, which ignored whitespace can make differ from the older one.
            assert(line.newLine, 'An added or unchanged line has a newer line number');
            const text = diff.after[line.newLine - 1] ?? '';
            lines.push({ key, path, side: 'after', line: line.newLine, text, counted: true });
        }
    }

    return lines;
}
