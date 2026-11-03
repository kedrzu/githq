import { assertNever } from '@nzyme/utils/assertNever.js';

import type { DiffRange, FileDiff } from './computeFileDiff.js';

/** The two layouts of a diff (D3). */
export type DiffLayout = 'split' | 'unified';

export interface BuildDiffRowsOptions {
    readonly layout: DiffLayout;
    /** How many unchanged lines to show on each side of a change. */
    readonly context: number;
    /** Lines shown although unchanged and away from any change (D6), as {@link addDiffLineRange} keeps them. */
    readonly expanded?: readonly DiffLineRange[];
}

/** Lines of a file's newer version, in 0-based indices, the end exclusive. */
export interface DiffLineRange {
    readonly start: number;
    readonly end: number;
}

/** One side of a split row. Its text is `FileDiff.before[line - 1]` on the left and `FileDiff.after[line - 1]` on the right. */
export interface DiffCell {
    /** 1-based line number. */
    readonly line: number;
    readonly kind: 'context' | 'deleted' | 'added';
}

/** A row of the split layout, `null` on the side with nothing. */
export interface DiffSplitRow {
    readonly kind: 'line';
    readonly layout: 'split';
    readonly key: string;
    readonly left: DiffCell | null;
    readonly right: DiffCell | null;
}

/**
 * A row of the unified layout. Its text is `FileDiff.after[newLine - 1]`, or `FileDiff.before[oldLine - 1]` on a deleted
 * row. With whitespace ignored a context row's two texts can differ; this layout shows the newer one.
 */
export interface DiffUnifiedRow {
    readonly kind: 'line';
    readonly layout: 'unified';
    readonly key: string;
    readonly oldLine: number | null;
    readonly newLine: number | null;
    readonly sign: ' ' | '-' | '+';
}

/** Unchanged lines left out of the rows. */
export interface DiffGapRow {
    readonly kind: 'gap';
    readonly key: string;
    /** How many lines are hidden, the same number in both versions. */
    readonly hidden: number;
    readonly range: DiffRange;
}

/** A row of the flat list of a file's diff. */
export type DiffRow = DiffSplitRow | DiffUnifiedRow | DiffGapRow;

/**
 * The flat rows of a file's diff. Rows hold line numbers, not text, to stay small on a file of 100k lines. A key is built
 * from line numbers alone and is unique within one layout of one file, so the same line keeps its key whatever else is
 * rebuilt around it, expanded lines arriving included. The layouts share keys, so heights measured under a key belong to
 * one layout.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildDiffRows(diff: FileDiff, options: BuildDiffRowsOptions): DiffRow[] {
    const { layout, context, expanded = [] } = options;
    const rows: DiffRow[] = [];

    let previous: DiffRange | null = null;
    for (const block of diff.blocks) {
        pushUnchanged(previous, block);
        pushChanged(block);
        previous = block;
    }

    pushUnchanged(previous, null);
    return rows;

    // Unchanged lines between two changes, or between a change and the file's edge, where no context is due.
    function pushUnchanged(start: DiffRange | null, end: DiffRange | null) {
        const beforeStart = start?.beforeEnd ?? 0;
        const afterStart = start?.afterEnd ?? 0;
        const count = (end?.beforeStart ?? diff.before.length) - beforeStart;
        const leading = start ? Math.min(context, count) : 0;
        const trailing = end ? Math.min(context, count - leading) : 0;
        const hidden = count - leading - trailing;

        pushContext(beforeStart, afterStart, leading);

        // What the expanded lines leave of the part out of reach of any context. Unchanged, so the versions are a shift apart.
        const shift = beforeStart - afterStart;
        const stop = afterStart + leading + hidden;
        let at = afterStart + leading;
        for (const range of expanded) {
            const from = Math.max(range.start, at);
            const to = Math.min(range.end, stop);
            if (from < to) {
                pushGap(at, from, shift);
                pushContext(from + shift, from, to - from);
                at = to;
            }
        }

        pushGap(at, stop, shift);
        pushContext(stop + shift, stop, trailing);
    }

    function pushGap(afterStart: number, afterEnd: number, shift: number) {
        if (afterStart < afterEnd) {
            rows.push({
                kind: 'gap',
                key: `gap:${afterStart + shift + 1}:${afterStart + 1}`,
                hidden: afterEnd - afterStart,
                range: {
                    beforeStart: afterStart + shift,
                    beforeEnd: afterEnd + shift,
                    afterStart,
                    afterEnd,
                },
            });
        }
    }

    function pushContext(beforeStart: number, afterStart: number, count: number) {
        for (let offset = 0; offset < count; offset++) {
            const oldLine = beforeStart + offset + 1;
            const newLine = afterStart + offset + 1;
            switch (layout) {
                case 'split':
                    rows.push(createSplitRow({ line: oldLine, kind: 'context' }, { line: newLine, kind: 'context' }));
                    break;
                case 'unified':
                    rows.push(createUnifiedRow(oldLine, newLine, ' '));
                    break;
                default:
                    assertNever(layout);
            }
        }
    }

    function pushChanged(block: DiffRange) {
        const deleted = block.beforeEnd - block.beforeStart;
        const added = block.afterEnd - block.afterStart;
        switch (layout) {
            case 'split':
                for (let offset = 0; offset < Math.max(deleted, added); offset++) {
                    rows.push(
                        createSplitRow(
                            offset < deleted ? { line: block.beforeStart + offset + 1, kind: 'deleted' } : null,
                            offset < added ? { line: block.afterStart + offset + 1, kind: 'added' } : null,
                        ),
                    );
                }

                break;
            case 'unified':
                for (let offset = 0; offset < deleted; offset++) {
                    rows.push(createUnifiedRow(block.beforeStart + offset + 1, null, '-'));
                }

                for (let offset = 0; offset < added; offset++) {
                    rows.push(createUnifiedRow(null, block.afterStart + offset + 1, '+'));
                }

                break;
            default:
                assertNever(layout);
        }
    }
}

/**
 * The ranges with one more, in order, those touching merged: what {@link BuildDiffRowsOptions.expanded} takes.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function addDiffLineRange(ranges: readonly DiffLineRange[], added: DiffLineRange): DiffLineRange[] {
    const merged: DiffLineRange[] = [];
    for (const range of [...ranges, added].toSorted((a, b) => a.start - b.start)) {
        const last = merged.at(-1);
        if (last && range.start <= last.end) {
            merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, range.end) };
        } else {
            merged.push(range);
        }
    }

    return merged;
}

function createSplitRow(left: DiffCell | null, right: DiffCell | null): DiffSplitRow {
    return { kind: 'line', layout: 'split', key: getLineRowKey(left?.line ?? null, right?.line ?? null), left, right };
}

function createUnifiedRow(
    oldLine: number | null,
    newLine: number | null,
    sign: DiffUnifiedRow['sign'],
): DiffUnifiedRow {
    return { kind: 'line', layout: 'unified', key: getLineRowKey(oldLine, newLine), oldLine, newLine, sign };
}

function getLineRowKey(oldLine: number | null, newLine: number | null): string {
    return `${oldLine ?? '-'}:${newLine ?? '-'}`;
}
