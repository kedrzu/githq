import { assertNever } from '@nzyme/utils/assertNever.js';

import { buildDiffRows, createDiffChangedRows, createDiffContextRow } from './diff/buildDiffRows.js';
import type { DiffLayout, DiffLineRange, DiffSplitRow, DiffUnifiedRow } from './diff/buildDiffRows.js';
import type { DiffRange, FileDiff } from './diff/computeFileDiff.js';
import { findEnclosing } from './diff/findEnclosing.js';
import type { ReviewFile, ReviewFileCollapseReason, ReviewFileSizes } from './ReviewFiles.js';
import type { FileSyntax } from './syntax/createFileSyntax.js';
import { countThreads } from './threads/countThreads.js';
import type { ThreadCounts } from './threads/countThreads.js';
import type { ThreadOnHiddenLine, ThreadOnLine, ThreadPlacement } from './threads/placeThreads.js';

/** How many unchanged lines show around a change. */
export const CONTEXT_LINES = 3;
/** Nothing a path can hold, so a key's first part is always its file. */
const KEY_SEPARATOR = '\0';
/** A placeholder as tall as the file will about be, up to this: a huge file's scrollbar isn't worth a huge box. */
const PLACEHOLDER_MAX_LINES = 2000;
const PLACEHOLDER_MIN_LINES = 3;
const LINE_HEIGHT = 20;
/** The line above the bars of a file fetched ahead of the rest. */
const FETCHING_FIRST_HEIGHT = 40;
/** A comment of two lines, and what stands between comments. */
const COMMENT_HEIGHT = 56;
/** A thread's padding and edges, and the room around it. */
const THREAD_FRAME_HEIGHT = 42;
/** A resolved thread's line and the room around it. */
const THREAD_LINE_HEIGHT = 48;
/** The label and the lines of the code a thread shows in a box. */
const THREAD_CODE_HEIGHT = 110;

/** The pinned head of a file's block (D24). */
export interface ReviewHeaderRow {
    readonly kind: 'header';
    readonly key: string;
    readonly file: ReviewFile;
    /** Only this shows of the file. */
    readonly collapsed: boolean;
    /** Why it starts collapsed, also once opened. */
    readonly collapseReason: ReviewFileCollapseReason | null;
    /** Rows follow it although it is collapsed: its threads, so it has no bottom edge of its own. */
    readonly threadsUnder: boolean;
    /** `null` for a file without threads. */
    readonly threads: ThreadCounts | null;
}

/** A line of a file's diff, with the diff its text is read from. */
export interface ReviewLineRow {
    readonly kind: 'line';
    readonly key: string;
    readonly line: DiffSplitRow | DiffUnifiedRow;
    readonly diff: FileDiff;
    /** What colours its text, `null` for none. */
    readonly syntax: FileSyntax | null;
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
    /** The file's first gap, saying that the context expanded in it was reset by a push (CR62). */
    readonly expansionReset: boolean;
}

/** A file not read or not computed yet: quiet bars about as tall as its diff (D35). */
export interface ReviewPlaceholderRow {
    readonly kind: 'placeholder';
    readonly key: string;
    readonly file: ReviewFile;
    /** A jump is fetching it ahead of the rest, and it says so (CR61). */
    readonly first: boolean;
}

/** A file with nothing to show as a diff, saying why. */
export interface ReviewNoticeRow {
    readonly kind: 'notice';
    readonly key: string;
    readonly file: ReviewFile;
    readonly notice: 'binary' | 'empty' | 'tooLarge';
    /** Nothing of either side for `empty`. */
    readonly sizes: ReviewFileSizes;
}

/** A file that could not be read, in place (D35): GitHub's words, and it can be tried again. */
export interface ReviewFailedRow {
    readonly kind: 'failed';
    readonly key: string;
    readonly file: ReviewFile;
    readonly error: Error;
}

/** A file waiting for GitHub's allowance, in place (D35). */
export interface ReviewPausedRow {
    readonly kind: 'paused';
    readonly key: string;
    readonly file: ReviewFile;
    /** When it comes, epoch ms. */
    readonly until: number;
    /** How many others wait with it, said by the first of them only (CR68); `null` for those after it. */
    readonly others: number | null;
}

/** A thread, under its line or under its file's header. Stays under one key wherever the thread goes (D7). */
export interface ReviewThreadRow {
    readonly kind: 'thread';
    readonly key: string;
    readonly placement: ThreadPlacement;
    /** Under a line of the diff: on which half in split, or in unified (D24). `null` when it has the file's width. */
    readonly inline: 'left' | 'right' | 'unified' | null;
}

/** The mark above code shown out of place for its thread (D29). */
export interface ReviewDistanceRow {
    readonly kind: 'distance';
    readonly key: string;
    readonly placement: ThreadOnHiddenLine;
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
    | ReviewDistanceRow
    | ReviewEndRow
    | ReviewFailedRow
    | ReviewGapRow
    | ReviewHeaderRow
    | ReviewLineRow
    | ReviewNoticeRow
    | ReviewPausedRow
    | ReviewPlaceholderRow
    | ReviewTailRow
    | ReviewThreadRow;

/** What shows under a file's header. */
export type ReviewFileContent =
    | { readonly kind: 'placeholder'; readonly first?: boolean }
    | { readonly kind: 'collapsed' }
    /** Gone from the diff (D12): nothing but its threads. */
    | { readonly kind: 'gone' }
    | ({ readonly kind: 'binary' } & ReviewFileSizes)
    | ({ readonly kind: 'tooLarge' } & ReviewFileSizes)
    | { readonly kind: 'failed'; readonly error: Error }
    | { readonly kind: 'paused'; readonly until: number }
    | { readonly kind: 'lines'; readonly rows: readonly ReviewRow[] };

export interface BuildReviewRowsParams {
    /** In the order they show. */
    readonly files: readonly ReviewFile[];
    readonly getContent: (file: ReviewFile) => ReviewFileContent;
    /** `null` for each if not given. */
    readonly getCollapseReason?: (file: ReviewFile) => ReviewFileCollapseReason | null;
    /** A file's threads, wherever they show; lines of the file already hold theirs ({@link BuildFileLineRowsParams.threads}). */
    readonly getThreads?: (file: ReviewFile) => readonly ThreadPlacement[] | undefined;
    /** Whether a collapsed file shows its threads under its header (D13); `true` if not given. */
    readonly threadsInCollapsed?: boolean;
}

/**
 * The flat rows of a review: for each file its pinned header, what shows under it and its end, and room after the last.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildReviewRows({
    files,
    getContent,
    getCollapseReason,
    getThreads,
    threadsInCollapsed = true,
}: BuildReviewRowsParams): ReviewRow[] {
    const rows: ReviewRow[] = [];
    const contents = files.map(getContent);
    const paused = contents.filter(content => content.kind === 'paused').length;
    let saidOthers = false;
    for (const [index, file] of files.entries()) {
        const content = contents[index] ?? getContent(file);
        const { path } = file;
        const collapsed = content.kind === 'collapsed';
        const collapseReason = getCollapseReason?.(file) ?? null;
        const placements = getThreads?.(file) ?? [];
        // In a file with no text here, as lines hold theirs.
        const under =
            content.kind === 'lines' || (collapsed && !threadsInCollapsed)
                ? []
                : placements.map((placement): ReviewThreadRow => createThreadRow(path, placement, null));
        rows.push({
            kind: 'header',
            key: getReviewHeaderKey(path),
            file,
            collapsed,
            collapseReason,
            threadsUnder: under.length > 0,
            threads: placements.length > 0 ? countThreads(placements) : null,
        });
        rows.push(...under);
        switch (content.kind) {
            case 'collapsed':
            case 'gone':
                break;
            case 'placeholder':
                rows.push({
                    kind: 'placeholder',
                    key: path + KEY_SEPARATOR + 'placeholder',
                    file,
                    first: content.first === true,
                });
                break;
            case 'binary':
            case 'tooLarge':
                rows.push({
                    kind: 'notice',
                    key: path + KEY_SEPARATOR + 'notice',
                    file,
                    notice: content.kind,
                    sizes: { before: content.before, after: content.after },
                });
                break;
            case 'paused':
                rows.push({
                    kind: 'paused',
                    key: path + KEY_SEPARATOR + 'paused',
                    file,
                    until: content.until,
                    others: saidOthers ? null : paused - 1,
                });
                saidOthers = true;
                break;
            case 'failed':
                rows.push({ kind: 'failed', key: path + KEY_SEPARATOR + 'failed', file, error: content.error });
                break;
            case 'lines':
                if (content.rows.length === 0) {
                    rows.push({
                        kind: 'notice',
                        key: path + KEY_SEPARATOR + 'notice',
                        file,
                        notice: 'empty',
                        sizes: { before: null, after: null },
                    });
                }

                for (const row of content.rows) {
                    rows.push(row);
                }

                break;
            default:
                assertNever(content);
        }

        // Its own key: the height and the place held of an open file's end are not this one's.
        const headerAlone = collapsed && under.length === 0;
        rows.push({
            kind: 'end',
            key: path + KEY_SEPARATOR + (headerAlone ? 'collapsedEnd' : 'end'),
            collapsed: headerAlone,
        });
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
    readonly syntax?: FileSyntax;
    readonly layout: DiffLayout;
    /** The lines shown beyond the context. */
    readonly expanded?: readonly DiffLineRange[];
    /** A push reset the context expanded in the file: its first gap says so. */
    readonly expansionReset?: boolean;
    /** The file's threads as placed on this diff: their rows go in where they belong. */
    readonly threads?: readonly ThreadPlacement[];
}

/**
 * The rows of a file's diff in a layout. Their keys are unique across files and layouts: the heights an
 * {@link AnchoredList} remembers by key belong to one layout.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildFileLineRows({
    path,
    diff,
    syntax,
    layout,
    expanded,
    expansionReset = false,
    threads = [],
}: BuildFileLineRowsParams): ReviewRow[] {
    let resetToSay = expansionReset;
    const rows = buildDiffRows(diff, { layout, context: CONTEXT_LINES, expanded }).map((row): ReviewRow => {
        const key = path + KEY_SEPARATOR + row.key + KEY_SEPARATOR + layout;
        if (row.kind !== 'gap') {
            return { kind: 'line', key, line: row, diff, syntax: syntax ?? null };
        }

        const { range } = row;
        const atFileEnd = range.afterEnd === diff.after.length;
        const saysReset = resetToSay;
        resetToSay = false;
        return {
            kind: 'gap',
            key,
            hidden: row.hidden,
            firstLine: range.afterStart + 1,
            firstOlderLine: range.beforeStart + 1,
            range,
            atFileEnd,
            enclosing: findEnclosing(diff.after, atFileEnd ? range.afterStart : range.afterEnd),
            expansionReset: saysReset,
        };
    });

    return threads.length > 0 ? insertThreadRows({ path, diff, syntax, layout, rows, threads }) : rows;
}

interface InsertThreadRowsParams extends Pick<BuildFileLineRowsParams, 'path' | 'diff' | 'syntax' | 'layout'> {
    readonly rows: readonly ReviewRow[];
    readonly threads: readonly ThreadPlacement[];
}

/**
 * The rows with the threads in: those that found no line first (D30), those on a line right after it, and those on hidden
 * lines with their code by their gap, the nearer a change above it before the gap and the nearer one below it after, which
 * keeps them in the order of the lines.
 */
function insertThreadRows({ path, diff, syntax, layout, rows, threads }: InsertThreadRowsParams) {
    const result: ReviewRow[] = [];
    const underRows = new Map<string, ThreadOnLine[]>();
    const inGaps = new Map<number, ThreadOnHiddenLine[]>();
    for (const placement of threads) {
        switch (placement.kind) {
            case 'onLine':
                addTo(underRows, placement.rowKeys[layout], placement);
                break;
            case 'hiddenLine':
                addTo(inGaps, placement.gap.afterStart, placement);
                break;
            default:
                result.push(createThreadRow(path, placement, null));
        }
    }

    for (const row of rows) {
        if (row.kind === 'gap') {
            const inGap = (inGaps.get(row.range.afterStart) ?? []).toSorted(
                (a, b) => getGapOffset(a, a.line) - getGapOffset(b, b.line),
            );
            pushPieces(inGap.filter(placement => placement.direction === 'down'));
            result.push(row);
            pushPieces(inGap.filter(placement => placement.direction === 'up'));
        } else {
            result.push(row);
            if (row.kind === 'line') {
                for (const placement of underRows.get(row.line.key) ?? []) {
                    result.push(createThreadRow(path, placement, getInlineSide(placement.side, layout)));
                }
            }
        }
    }

    return result;

    /** Each with its mark and its code, or under the last one's code when that reaches its line. */
    function pushPieces(placements: readonly ThreadOnHiddenLine[]) {
        let shownUpTo = -1;
        for (const placement of placements) {
            const last = getGapOffset(placement, placement.line);
            const first = Math.max(getGapOffset(placement, placement.firstLine), shownUpTo + 1);
            if (first === getGapOffset(placement, placement.firstLine)) {
                result.push({
                    kind: 'distance',
                    key: path + KEY_SEPARATOR + 'distance' + KEY_SEPARATOR + placement.thread.id,
                    placement,
                });
            }

            for (let offset = first; offset <= last; offset++) {
                pushCode(placement, offset);
            }

            shownUpTo = Math.max(shownUpTo, last);
            result.push(createThreadRow(path, placement, getInlineSide(placement.side, layout)));
        }
    }

    function pushCode(placement: ThreadOnHiddenLine, offset: number) {
        const { gap, thread, whitespaceChange, line } = placement;
        const oldLine = gap.beforeStart + offset + 1;
        const newLine = gap.afterStart + offset + 1;
        const lines =
            whitespaceChange && offset === getGapOffset(placement, line)
                ? createDiffChangedRows(layout, oldLine, newLine)
                : [createDiffContextRow(layout, oldLine, newLine)];
        for (const shown of lines) {
            result.push({
                kind: 'line',
                key:
                    path +
                    KEY_SEPARATOR +
                    'threadCode' +
                    KEY_SEPARATOR +
                    thread.id +
                    KEY_SEPARATOR +
                    shown.key +
                    KEY_SEPARATOR +
                    layout,
                line: shown,
                diff,
                syntax: syntax ?? null,
            });
        }
    }
}

function addTo<K, V>(map: Map<K, V[]>, key: K, value: V) {
    const values = map.get(key);
    if (values) {
        values.push(value);
    } else {
        map.set(key, [value]);
    }
}

function createThreadRow(path: string, placement: ThreadPlacement, inline: ReviewThreadRow['inline']): ReviewThreadRow {
    return { kind: 'thread', key: getReviewThreadKey(path, placement.thread.id), placement, inline };
}

function getInlineSide(side: ThreadOnLine['side'], layout: DiffLayout): ReviewThreadRow['inline'] {
    if (layout === 'unified') {
        return 'unified';
    }

    return side === 'before' ? 'left' : 'right';
}

/** How far into its gap a line of a thread's side is, the same on both sides of the gap. */
function getGapOffset({ gap, side }: ThreadOnHiddenLine, line: number) {
    return line - 1 - (side === 'before' ? gap.beforeStart : gap.afterStart);
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
 * The lines "Expand to here" brings out of a gap (D29): those between the row nearest a thread and the thread.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getDistanceLinesToShow({ placement }: ReviewDistanceRow): DiffLineRange {
    const { gap, line, direction } = placement;
    const offset = getGapOffset(placement, line);
    return direction === 'down'
        ? { start: gap.afterStart, end: gap.afterStart + offset + 1 }
        : { start: gap.afterStart + offset, end: gap.afterEnd };
}

/**
 * The key of a thread's row: the same wherever the thread shows, in whichever layout, so that a jump's landing on it holds.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getReviewThreadKey(path: string, threadId: string) {
    return path + KEY_SEPARATOR + 'thread' + KEY_SEPARATOR + threadId;
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
        case 'distance':
            return 26;
        case 'thread':
            return estimateThreadHeight(row);
        case 'placeholder':
            return getPlaceholderHeight(row.file) + (row.first ? FETCHING_FIRST_HEIGHT : 0);
        case 'notice':
        case 'failed':
        case 'paused':
            return 58;
        case 'end':
            return row.collapsed ? 12 : 16;
        case 'tail':
            return 600;
        default:
            return assertNever(row);
    }
}

function estimateThreadHeight({ placement }: ReviewThreadRow) {
    const { thread } = placement;
    if (thread.isResolved) {
        return THREAD_LINE_HEIGHT;
    }

    const hasCode = 'diffHunk' in placement && placement.diffHunk !== '';
    return THREAD_FRAME_HEIGHT + thread.comments.length * COMMENT_HEIGHT + (hasCode ? THREAD_CODE_HEIGHT : 0);
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
 * for a placeholder or a file waiting for the allowance: how far into it the reader was says nothing about what replaced
 * it, often much shorter, so its file shows from its header. So does a file just collapsed or opened: all it still has in common is its header.
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

    if (
        held?.kind === 'placeholder' ||
        held?.kind === 'paused' ||
        held?.kind === 'end' ||
        next[start + 1]?.kind === 'end' ||
        (header.kind === 'header' && header.collapsed)
    ) {
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
        case 'distance':
            return { side: row.placement.side, line: row.placement.firstLine };
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
