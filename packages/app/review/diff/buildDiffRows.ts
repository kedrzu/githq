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

/** Which version of a file a line number counts in. */
export type DiffLineSide = keyof Pick<FileDiff, 'before' | 'after'>;

/** A line of a file, on a side. */
export interface DiffLine {
    readonly side: DiffLineSide;
    /** 1-based. */
    readonly line: number;
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

/** Unchanged lines left out of the rows, never a single one: a gap row is taller than the line it would hide. */
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

    // A single line shows: a gap row would be taller than the line it hides.
    function pushGap(afterStart: number, afterEnd: number, shift: number) {
        if (afterEnd - afterStart === 1) {
            pushContext(afterStart + shift, afterStart, 1);
        } else if (afterStart < afterEnd) {
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
            rows.push(createDiffContextRow(layout, beforeStart + offset + 1, afterStart + offset + 1));
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

/**
 * The key of the row {@link buildDiffRows} shows a line in, in that layout, without building the rows: only a changed line's
 * differs between the layouts, as split pairs it with its neighbour across. The line must be on a row, in no gap.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getDiffLineRowKey(diff: FileDiff, { side, line }: DiffLine, layout: DiffLayout): string {
    const onBefore = side === 'before';
    const other = onBefore ? 'after' : 'before';
    const block = diff.blocks.findLast(range => getSideStart(range, side) < line);
    if (block && line <= getSideEnd(block, side)) {
        const paired = getSideStart(block, other) + line - 1 - getSideStart(block, side);
        const across = layout === 'split' && paired < getSideEnd(block, other) ? paired + 1 : null;
        return onBefore ? getLineRowKey(line, across) : getLineRowKey(across, line);
    }

    const beforeEnd = block?.beforeEnd ?? 0;
    const afterEnd = block?.afterEnd ?? 0;
    return onBefore
        ? getLineRowKey(line, line - beforeEnd + afterEnd)
        : getLineRowKey(line - afterEnd + beforeEnd, line);
}

/**
 * Where a range starts on a side.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getSideStart(range: DiffRange, side: DiffLineSide): number {
    return side === 'before' ? range.beforeStart : range.afterStart;
}

/**
 * Where a range ends on a side, exclusive.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getSideEnd(range: DiffRange, side: DiffLineSide): number {
    return side === 'before' ? range.beforeEnd : range.afterEnd;
}

/**
 * The row of a line both versions hold, as {@link buildDiffRows} builds it, for one drawn away from them.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createDiffContextRow(
    layout: DiffLayout,
    oldLine: number,
    newLine: number,
): DiffSplitRow | DiffUnifiedRow {
    return layout === 'split'
        ? createSplitRow({ line: oldLine, kind: 'context' }, { line: newLine, kind: 'context' })
        : createUnifiedRow(oldLine, newLine, ' ');
}

/**
 * The rows of one line changed in whitespace alone, whose two versions are to show: one across in split, two in unified.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createDiffChangedRows(
    layout: DiffLayout,
    oldLine: number,
    newLine: number,
): (DiffSplitRow | DiffUnifiedRow)[] {
    return layout === 'split'
        ? [createSplitRow({ line: oldLine, kind: 'deleted' }, { line: newLine, kind: 'added' })]
        : [createUnifiedRow(oldLine, null, '-'), createUnifiedRow(null, newLine, '+')];
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
