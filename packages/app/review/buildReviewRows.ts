import { assertNever } from '@nzyme/utils/assertNever.js';

import { buildDiffRows } from './diff/buildDiffRows.js';
import type { DiffLayout, DiffLineRange, DiffSplitRow, DiffUnifiedRow } from './diff/buildDiffRows.js';
import type { DiffRange, FileDiff } from './diff/computeFileDiff.js';
import { findEnclosing } from './diff/findEnclosing.js';
import type { ReviewFile, ReviewFileCollapseReason } from './ReviewFiles.js';

/** How many unchanged lines show around a change. */
const CONTEXT_LINES = 3;
/** Nothing a path can hold, so a key's first part is always its file. */
const KEY_SEPARATOR = '\0';
/** A placeholder as tall as the file will about be, up to this: a huge file's scrollbar isn't worth a huge box. */
const PLACEHOLDER_MAX_LINES = 2000;
const PLACEHOLDER_MIN_LINES = 3;
const LINE_HEIGHT = 20;

/** The pinned head of a file's block (D24). */
export interface ReviewHeaderRow {
    readonly kind: 'header';
    readonly key: string;
    readonly file: ReviewFile;
    /** Only this shows of the file. */
    readonly collapsed: boolean;
    /** Why it starts collapsed, also once opened. */
    readonly collapseReason: ReviewFileCollapseReason | null;
}

/** A line of a file's diff, with the diff its text is read from. */
export interface ReviewLineRow {
    readonly kind: 'line';
    readonly key: string;
    readonly line: DiffSplitRow | DiffUnifiedRow;
    readonly diff: FileDiff;
}

/** Unchanged lines left out. */
export interface ReviewGapRow {
    readonly kind: 'gap';
    readonly key: string;
    readonly hidden: number;
    /** The first hidden line of the newer version, 1-based. */
    readonly firstLine: number;
    /** The first hidden line of the older version, 1-based. */
    readonly firstOlderLine: number;
    readonly range: DiffRange;
    /** No change follows it: what shows of it comes from its top. */
    readonly atFileEnd: boolean;
    /** The declaration what follows it sits in ({@link findEnclosing}). */
    readonly enclosing: string | null;
}

/** A file not read or not computed yet: quiet bars about as tall as its diff (D35). */
export interface ReviewPlaceholderRow {
    readonly kind: 'placeholder';
    readonly key: string;
    readonly file: ReviewFile;
}

/** A file with nothing to show as a diff, saying why. */
export interface ReviewNoticeRow {
    readonly kind: 'notice';
    readonly key: string;
    readonly file: ReviewFile;
    readonly notice: 'binary' | 'empty' | 'tooLarge';
}

/** A file that could not be read, in place (D35): GitHub's words, and it can be tried again. */
export interface ReviewFailedRow {
    readonly kind: 'failed';
    readonly key: string;
    readonly file: ReviewFile;
    readonly error: Error;
}

/** The bottom edge of a file's block, and the space under it. */
export interface ReviewEndRow {
    readonly kind: 'end';
    readonly key: string;
    /** Under a header alone, which has its own bottom edge: only the space. */
    readonly collapsed: boolean;
}

/** Room under the last file, so that a jump can land even a short last file at the very top (D7). */
export interface ReviewTailRow {
    readonly kind: 'tail';
    readonly key: string;
}

/** A row of the review's flat list. Its key begins with its file's path ({@link getReviewRowPath}). */
export type ReviewRow =
    | ReviewEndRow
    | ReviewFailedRow
    | ReviewGapRow
    | ReviewHeaderRow
    | ReviewLineRow
    | ReviewNoticeRow
    | ReviewPlaceholderRow
    | ReviewTailRow;

/** What shows under a file's header. */
export type ReviewFileContent =
    | { readonly kind: 'placeholder' }
    | { readonly kind: 'collapsed' }
    | { readonly kind: 'binary' }
    | { readonly kind: 'tooLarge' }
    | { readonly kind: 'failed'; readonly error: Error }
    | { readonly kind: 'lines'; readonly rows: readonly ReviewRow[] };

export interface BuildReviewRowsParams {
    /** In the order they show. */
    readonly files: readonly ReviewFile[];
    readonly getContent: (file: ReviewFile) => ReviewFileContent;
    /** `null` for each if not given. */
    readonly getCollapseReason?: (file: ReviewFile) => ReviewFileCollapseReason | null;
}

/**
 * The flat rows of a review: for each file its pinned header, what shows under it and its end, and room after the last.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildReviewRows({ files, getContent, getCollapseReason }: BuildReviewRowsParams): ReviewRow[] {
    const rows: ReviewRow[] = [];
    for (const file of files) {
        const content = getContent(file);
        const { path } = file;
        const collapsed = content.kind === 'collapsed';
        const collapseReason = getCollapseReason?.(file) ?? null;
        rows.push({ kind: 'header', key: getReviewHeaderKey(path), file, collapsed, collapseReason });
        switch (content.kind) {
            case 'collapsed':
                break;
            case 'placeholder':
                rows.push({ kind: 'placeholder', key: path + KEY_SEPARATOR + 'placeholder', file });
                break;
            case 'binary':
            case 'tooLarge':
                rows.push({ kind: 'notice', key: path + KEY_SEPARATOR + 'notice', file, notice: content.kind });
                break;
            case 'failed':
                rows.push({ kind: 'failed', key: path + KEY_SEPARATOR + 'failed', file, error: content.error });
                break;
            case 'lines':
                if (content.rows.length === 0) {
                    rows.push({ kind: 'notice', key: path + KEY_SEPARATOR + 'notice', file, notice: 'empty' });
                }

                for (const row of content.rows) {
                    rows.push(row);
                }

                break;
            default:
                assertNever(content);
        }

        // Its own key: the height and the place held of an open file's end are not this one's.
        rows.push({ kind: 'end', key: path + KEY_SEPARATOR + (collapsed ? 'collapsedEnd' : 'end'), collapsed });
    }

    const last = files.at(-1);
    if (last) {
        rows.push({ kind: 'tail', key: last.path + KEY_SEPARATOR + 'tail' });
    }

    return rows;
}

export interface BuildFileLineRowsParams {
    readonly path: string;
    readonly diff: FileDiff;
    readonly layout: DiffLayout;
    /** The lines shown beyond the context. */
    readonly expanded?: readonly DiffLineRange[];
}

/**
 * The rows of a file's diff in a layout. Their keys are unique across files and layouts: the heights an
 * {@link AnchoredList} remembers by key belong to one layout.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildFileLineRows({ path, diff, layout, expanded }: BuildFileLineRowsParams): ReviewRow[] {
    return buildDiffRows(diff, { layout, context: CONTEXT_LINES, expanded }).map((row): ReviewRow => {
        const key = path + KEY_SEPARATOR + row.key + KEY_SEPARATOR + layout;
        if (row.kind !== 'gap') {
            return { kind: 'line', key, line: row, diff };
        }

        const { range } = row;
        const atFileEnd = range.afterEnd === diff.after.length;
        return {
            kind: 'gap',
            key,
            hidden: row.hidden,
            firstLine: range.afterStart + 1,
            firstOlderLine: range.beforeStart + 1,
            range,
            atFileEnd,
            enclosing: findEnclosing(diff.after, atFileEnd ? range.afterStart : range.afterEnd),
        };
    });
}

/**
 * The lines "Show 20" and "Show all" bring out of a gap (D6): those right above the change below it, the ones that say
 * what that change is in; at the file's end, with no change below, those right after the last one shown.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getGapLinesToShow(gap: ReviewGapRow, count: number): DiffLineRange {
    const { afterStart, afterEnd } = gap.range;
    return gap.atFileEnd
        ? { start: afterStart, end: Math.min(afterStart + count, afterEnd) }
        : { start: Math.max(afterEnd - count, afterStart), end: afterEnd };
}

/**
 * The key of a file's header: the same whatever the layout or the whitespace setting, which is what keeps a jump's
 * landing in place through them (D7).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getReviewHeaderKey(path: string) {
    return path + KEY_SEPARATOR + 'header';
}

/**
 * The file a row belongs to, by its key.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getReviewRowPath(key: string) {
    return key.slice(0, key.indexOf(KEY_SEPARATOR));
}

/**
 * The height of a row until it has been drawn.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function estimateReviewRowHeight(row: ReviewRow): number {
    switch (row.kind) {
        case 'header':
            return 38;
        case 'line':
            return LINE_HEIGHT;
        case 'gap':
            return 28;
        case 'placeholder':
            return getPlaceholderHeight(row.file);
        case 'notice':
        case 'failed':
            return 58;
        case 'end':
            return row.collapsed ? 12 : 16;
        case 'tail':
            return 600;
        default:
            return assertNever(row);
    }
}

/**
 * How tall a file's placeholder is, its real height too: about what its diff will take.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getPlaceholderHeight(file: ReviewFile): number {
    const lines = Math.min(Math.max(file.additions + file.deletions, PLACEHOLDER_MIN_LINES), PLACEHOLDER_MAX_LINES);
    return lines * LINE_HEIGHT;
}

export interface FindReplacementRowParams {
    /** The row held. */
    readonly key: string;
    /** The distance of its top from the viewport's top. */
    readonly offset: number;
    readonly previous: readonly ReviewRow[];
    readonly next: readonly ReviewRow[];
    /** Every file in the order they show, those not shown too; only those of `previous` if not given. */
    readonly order?: readonly string[];
}

/** The row to hold instead of one that is gone, and the distance of its top from the viewport's top. */
export interface ReviewRowReplacement {
    readonly row: ReviewRow;
    readonly offset: number;
}

/**
 * What to hold in place when the row held is gone from the new rows, because the layout or the whitespace setting
 * changed or the file arrived: the same line of the same file if shown, or else the nearest row above it (D7), a gap
 * counting when it covers that line; for anything else the top of what its file now shows; for the room under what was
 * the last file, what now follows that file, which is at the same place. All at the same distance from the top, but
 * for a placeholder: how far into it the reader was says nothing about what replaced it, often much shorter, so its
 * file shows from its header. So does a file just collapsed or opened: all it still has in common is its header.
 *
 * A file gone from the rows, marked viewed with those hidden or filtered away, gives way to the next file still there, or
 * the last before it when none follows (D9): at the top of the screen, or lower when its header was (D7). `null` when the
 * row is still there, or no file is left.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findReplacementRow({
    key,
    offset,
    previous,
    next,
    order,
}: FindReplacementRowParams): ReviewRowReplacement | null {
    if (next.some(row => row.key === key)) {
        return null;
    }

    const path = getReviewRowPath(key);
    const start = next.findIndex(row => row.key === getReviewHeaderKey(path));
    const header = next[start];
    const held = previous.find(row => row.key === key);
    if (!header) {
        return findNextFileHeader({ key, offset, previous, next, order });
    }

    if (held?.kind === 'placeholder' || held?.kind === 'end' || next[start + 1]?.kind === 'end') {
        return { row: header, offset: 0 };
    }

    const place = held ? getRowPlace(held) : null;
    const first = next[start + 1] ?? header;
    if (held?.kind === 'tail') {
        const end = next.findIndex(row => row.kind === 'end' && getReviewRowPath(row.key) === path);
        return { row: next[end + 1] ?? first, offset };
    }

    if (!place) {
        return { row: first, offset };
    }

    let nearest = first;
    for (let index = start + 1; index < next.length; index++) {
        const row = next[index];
        if (!row || row.kind === 'header') {
            break;
        }

        const line = getRowFirstLine(row, place.side);
        if (line !== null && line > place.line) {
            break;
        }

        if (line !== null) {
            nearest = row;
        }
    }

    return { row: nearest, offset };
}

function findNextFileHeader({
    key,
    offset,
    previous,
    next,
    order,
}: FindReplacementRowParams): ReviewRowReplacement | null {
    const path = getReviewRowPath(key);
    const paths = order ?? previous.filter(row => row.kind === 'header').map(row => getReviewRowPath(row.key));
    const at = paths.indexOf(path);
    if (at === -1) {
        return null;
    }

    const shown = new Map(next.filter(row => row.kind === 'header').map(row => [getReviewRowPath(row.key), row]));
    const heading =
        paths.slice(at + 1).find(other => shown.has(other)) ?? paths.slice(0, at).findLast(other => shown.has(other));
    const row = heading === undefined ? undefined : shown.get(heading);
    if (!row) {
        return null;
    }

    // Only a header can be below the top: the first row with its bottom below the top is any other's anchor, above it.
    const held = previous.find(other => other.key === key);
    return { row, offset: held?.kind === 'header' ? Math.max(offset, 0) : 0 };
}

interface RowPlace {
    readonly side: 'before' | 'after';
    readonly line: number;
}

function getRowPlace(row: ReviewRow): RowPlace | null {
    switch (row.kind) {
        case 'line': {
            const after = getLineNumber(row.line, 'after');
            return after === null
                ? { side: 'before', line: getLineNumber(row.line, 'before') ?? 1 }
                : { side: 'after', line: after };
        }
        case 'gap':
            return { side: 'after', line: row.firstLine };
        default:
            return null;
    }
}

/** Where a row starts on a side, the lines of a gap counted from its first; `null` for a row with no line there. */
function getRowFirstLine(row: ReviewRow, side: RowPlace['side']) {
    switch (row.kind) {
        case 'line':
            return getLineNumber(row.line, side);
        case 'gap':
            return side === 'after' ? row.firstLine : row.firstOlderLine;
        default:
            return null;
    }
}

function getLineNumber(line: DiffSplitRow | DiffUnifiedRow, side: RowPlace['side']): number | null {
    if (line.layout === 'split') {
        return (side === 'after' ? line.right?.line : line.left?.line) ?? null;
    }

    return side === 'after' ? line.newLine : line.oldLine;
}
