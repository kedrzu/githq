import { expect, test } from 'bun:test';

import type { AnchoredListShownRow, AnchoredListViewport } from '../AnchoredList.vue';
import { buildFileLineRows, buildReviewRows, estimateReviewRowHeight } from '../buildReviewRows.js';
import type { ReviewRow } from '../buildReviewRows.js';
import { computeFileDiff } from '../diff/computeFileDiff.js';
import type { ReviewFile } from '../ReviewFiles.js';
import { findCursorOnScreen } from './findCursorOnScreen.js';
import type { ReviewCursor } from './ReviewCursor.js';

const FILE: ReviewFile = {
    path: 'src/a.ts',
    previousPath: null,
    changeType: 'MODIFIED',
    additions: 2,
    deletions: 1,
    viewed: 'UNVIEWED',
};
const HEADER = 38;
const ROWS = buildRows();

test('the first stop wholly under the pinned header, the last wholly above the bottom', () => {
    // The header 38, the gap 26, then lines of 20: line 17 sits under the pinned header, line 18 half under it.
    const shown = layOut(ROWS, 54, 100);
    const viewport: AnchoredListViewport = { height: 100, covered: HEADER, scrolled: 54, remaining: 1000 };

    expect(describe(findCursorOnScreen({ rows: shown, viewport, edge: 'top' }))).toBe('19|19');
    expect(describe(findCursorOnScreen({ rows: shown, viewport, edge: 'bottom' }))).toBe('20|20');
});

test('at the top of the diff the first stop is the one under the header in place, not the header itself', () => {
    const shown = layOut(ROWS, 0, 100);
    const viewport: AnchoredListViewport = { height: 100, covered: HEADER, scrolled: 0, remaining: 1000 };

    expect(describe(findCursorOnScreen({ rows: shown, viewport, edge: 'top' }))).toBe('gap');
});

test('a stop taller than the screen is the cursor at either edge; with no stop showing, none is', () => {
    const [header, gap] = ROWS;
    const viewport: AnchoredListViewport = { height: 100, covered: HEADER, scrolled: 0, remaining: 1000 };
    const tall = [{ row: gap!, top: 20, bottom: 300 }];

    expect(findCursorOnScreen({ rows: tall, viewport, edge: 'top' })).toEqual({ key: gap!.key });
    expect(findCursorOnScreen({ rows: tall, viewport, edge: 'bottom' })).toEqual({ key: gap!.key });
    expect(findCursorOnScreen({ rows: [{ row: header!, top: 0, bottom: HEADER }], viewport, edge: 'top' })).toBeNull();
});

function buildRows() {
    const before = Array.from({ length: 40 }, (_, index) => `line ${index + 1}\n`).join('');
    const after = before.replace('line 20\n', 'line 20 changed\nline 20b\n');
    const diff = computeFileDiff({ before, after, ignoreWhitespace: false });
    return buildReviewRows({
        files: [FILE],
        getContent: () => ({ kind: 'lines', rows: buildFileLineRows({ path: FILE.path, diff, layout: 'split' }) }),
    });
}

/** The rows touching a viewport so tall scrolled so far, as `AnchoredList` gives them, at their estimated heights. */
function layOut(rows: readonly ReviewRow[], scrolled: number, height: number) {
    const shown: AnchoredListShownRow<ReviewRow>[] = [];
    let top = -scrolled;
    for (const row of rows) {
        const bottom = top + estimateReviewRowHeight(row);
        if (bottom > 0 && top < height) {
            shown.push({ row, top, bottom });
        }

        top = bottom;
    }

    return shown;
}

function describe(cursor: ReviewCursor | null) {
    const row = ROWS.find(other => other.key === cursor?.key);
    if (row?.kind !== 'line' || row.line.layout !== 'split') {
        return row?.kind ?? null;
    }

    return `${row.line.left?.line ?? '-'}|${row.line.right?.line ?? '-'}`;
}
