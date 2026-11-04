import { groupByToMap } from '@nzyme/utils/array/groupByToMap.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import { buildDiffRows, createDiffChangedRows, createDiffContextRow, getSideStart } from './diff/buildDiffRows.js';
import type { DiffLayout, DiffLineRange, DiffSplitRow, DiffUnifiedRow } from './diff/buildDiffRows.js';
import { isLineChanged } from './diff/computeFileDiff.js';
import type { DiffRange, FileDiff } from './diff/computeFileDiff.js';
import { findEnclosing } from './diff/findEnclosing.js';
import type { ReviewFile, ReviewFileCollapseReason, ReviewFileSizes } from './ReviewFiles.js';
import type { FileSyntax } from './syntax/createFileSyntax.js';
import { countThreads } from './threads/countThreads.js';
import type { ThreadCounts } from './threads/countThreads.js';
import type { ThreadOnHiddenLine, ThreadOnLine, ThreadPlacement } from './threads/placeThreads.js';
import type { ReviewCommentTarget } from './writing/ReviewWriting.js';

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
/** A comment box with one line of text. */
export const COMMENT_BOX_HEIGHT = 144;

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
    /** How many of its lines nothing shows: not those shown for a thread. */
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

/** A comment being written, placed like a thread, or under its file's header when its line isn't shown. Same key wherever it goes (D7). */
export interface ReviewCommentRow {
    readonly kind: 'comment';
    readonly key: string;
    readonly target: ReviewCommentTarget;
    readonly inline: ReviewThreadRow['inline'];
}

/** The mark above code shown out of place for its thread (D29). */
export interface ReviewDistanceRow {
    readonly kind: 'distance';
    readonly key: string;
    readonly placement: ThreadOnHiddenLine;
}

/** What is left of a file's last gap under the code shown for a thread: no changes follow (CR11). */
export interface ReviewFileEndRow {
    readonly kind: 'fileEnd';
    readonly key: string;
    /** How many lines are left to the file's end. */
    readonly hidden: number;
    /** What "Expand to here" brings out. */
    readonly lines: DiffLineRange;
}

/** A file whose only changes are in whitespace, which is hidden, so its diff has none (CR11). */
export interface ReviewOnlyWhitespaceRow {
    readonly kind: 'onlyWhitespace';
    readonly key: string;
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
    | ReviewCommentRow
    | ReviewDistanceRow
    | ReviewEndRow
    | ReviewFailedRow
    | ReviewFileEndRow
    | ReviewGapRow
    | ReviewHeaderRow
    | ReviewLineRow
    | ReviewNoticeRow
    | ReviewOnlyWhitespaceRow
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
    /** A file's comment boxes, wherever they show; lines of the file already hold theirs ({@link BuildFileLineRowsParams.comments}). */
    readonly getComments?: (file: ReviewFile) => readonly ReviewCommentTarget[] | undefined;
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
    getComments,
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
        // In a file with no text here, as lines hold theirs. Comments being written always show: they are not GitHub's yet.
        const threads =
            content.kind === 'lines' || (collapsed && !threadsInCollapsed)
                ? []
                : placements.map((placement): ReviewThreadRow => createThreadRow(path, placement, null));
        const comments =
            content.kind === 'lines'
                ? []
                : (getComments?.(file) ?? []).map(target => createCommentRow(path, target, null));
        const under = [...threads, ...comments];
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
    /** The file's comment boxes: under their lines, or at its top when those aren't shown. */
    readonly comments?: readonly ReviewCommentTarget[];
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
    comments = [],
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

    const withThreads = insertCommentRows(
        threads.length > 0 ? insertThreadRows({ path, diff, syntax, layout, rows, threads }) : rows,
        { path, layout, comments },
    );
    if (!isOnlyWhitespaceChanged(diff)) {
        return withThreads;
    }

    // In place of the gap that would be the whole file, nothing having been expanded.
    return [
        { kind: 'onlyWhitespace', key: path + KEY_SEPARATOR + 'onlyWhitespace' + KEY_SEPARATOR + layout },
        ...withThreads.filter(row => row.kind !== 'gap' || !isWholeFile(row)),
    ];
}

/** Nothing changed, as far as the diff goes, and yet the lines differ: only hidden whitespace can do that. */
function isOnlyWhitespaceChanged(diff: FileDiff) {
    return (
        diff.blocks.length === 0 && diff.before.some((_, index) => isLineChanged(diff, { before: index, after: index }))
    );
}

function isWholeFile({ atFileEnd, range }: ReviewGapRow) {
    return atFileEnd && range.afterStart === 0;
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
    const underRows = groupByToMap(
        threads.filter(placement => placement.kind === 'onLine'),
        placement => placement.rowKeys[layout],
    );
    const inGaps = groupByToMap(
        threads.filter(placement => placement.kind === 'hiddenLine'),
        placement => placement.gap.afterStart,
    );
    for (const placement of threads) {
        if (placement.kind !== 'onLine' && placement.kind !== 'hiddenLine') {
            result.push(createThreadRow(path, placement, null));
        }
    }

    for (const row of rows) {
        if (row.kind === 'gap') {
            const inGap = (inGaps.get(row.range.afterStart) ?? []).toSorted(
                (a, b) => getGapOffset(a, a.line) - getGapOffset(b, b.line),
            );
            pushPieces(inGap.filter(placement => placement.direction === 'down'));
            const last = inGap.at(-1);
            if (last && row.atFileEnd && !isWholeFile(row) && !row.expansionReset) {
                pushFileEnd(row, getGapOffset(last, last.line) + 1);
            } else {
                const hidden = row.hidden - countShownLines(inGap);
                // Nothing left of it but a push to say, which only it can.
                if (hidden > 0 || row.expansionReset) {
                    result.push({ ...row, hidden });
                }
            }

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

    /** In place of the file's last gap, under the code shown for the last thread in it. */
    function pushFileEnd({ range, hidden, key }: ReviewGapRow, shown: number) {
        const left = hidden - shown;
        if (left > 0) {
            result.push({
                kind: 'fileEnd',
                key: key + KEY_SEPARATOR + 'end',
                hidden: left,
                lines: { start: range.afterStart + shown, end: range.afterEnd },
            });
        }
    }

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

interface InsertCommentRowsParams extends Pick<BuildFileLineRowsParams, 'path' | 'layout'> {
    readonly comments: readonly ReviewCommentTarget[];
}

/** Each after its line and what already sits under it; with its line not shown, first, for its text to stay in sight. */
function insertCommentRows(rows: readonly ReviewRow[], { path, layout, comments }: InsertCommentRowsParams) {
    const result = [...rows];
    for (const target of comments) {
        const shown = result.findLastIndex(
            row => row.kind === 'line' && getLineNumber(row.line, target.side) === target.line,
        );
        if (shown === -1) {
            result.unshift(createCommentRow(path, target, null));
            continue;
        }

        let at = shown + 1;
        while (result[at]?.kind === 'thread' || result[at]?.kind === 'comment') {
            at++;
        }

        result.splice(at, 0, createCommentRow(path, target, getInlineSide(target.side, layout)));
    }

    return result;
}

/** How many lines of a gap the threads in it show, however many of them show the same line. */
function countShownLines(placements: readonly ThreadOnHiddenLine[]) {
    const shown = new Set<number>();
    for (const placement of placements) {
        const last = getGapOffset(placement, placement.line);
        for (let offset = getGapOffset(placement, placement.firstLine); offset <= last; offset++) {
            shown.add(offset);
        }
    }

    return shown.size;
}

function createThreadRow(path: string, placement: ThreadPlacement, inline: ReviewThreadRow['inline']): ReviewThreadRow {
    return { kind: 'thread', key: getReviewThreadKey(path, placement.thread.id), placement, inline };
}

function createCommentRow(
    path: string,
    target: ReviewCommentTarget,
    inline: ReviewThreadRow['inline'],
): ReviewCommentRow {
    return { kind: 'comment', key: getReviewCommentKey(path, target.id), target, inline };
}

function getInlineSide(side: ThreadOnLine['side'], layout: DiffLayout): ReviewThreadRow['inline'] {
    if (layout === 'unified') {
        return 'unified';
    }

    return side === 'before' ? 'left' : 'right';
}

/** How far into its gap a line of a thread's side is, the same on both sides of the gap. */
function getGapOffset({ gap, side }: ThreadOnHiddenLine, line: number) {
    return line - 1 - getSideStart(gap, side);
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
 * The key of a comment box's row: the same wherever it shows, in whichever layout, so that it holds through them and a typing
 * hand keeps its place (D7).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getReviewCommentKey(path: string, id: string) {
    return path + KEY_SEPARATOR + 'comment' + KEY_SEPARATOR + id;
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
        case 'fileEnd':
            return 26;
        case 'onlyWhitespace':
            return 30;
        case 'thread':
            return estimateThreadHeight(row);
        case 'comment':
            return COMMENT_BOX_HEIGHT;
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

/**
 * A place in a review, by identity: what a position is kept as, for a line's rows and their keys differ per layout.
 * `row`: any row whose key every layout shares, a thread or a file's header.
 */
export type ReviewPlace =
    | ({ readonly kind: 'line'; readonly path: string } & RowLine)
    | { readonly kind: 'row'; readonly key: string };

/** "Where you are" (D7), to come back to: a place, and the distance of its top from the viewport's top. */
export interface ReviewPosition {
    readonly place: ReviewPlace;
    readonly offset: number;
}

/**
 * Where a row at that distance from the top is. Inside a file not here, how far says nothing of what will replace it: its
 * header, at the top.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getReviewPosition(row: ReviewRow, offset: number): ReviewPosition {
    const path = getReviewRowPath(row.key);
    if (row.kind === 'placeholder' || row.kind === 'paused') {
        return { place: { kind: 'row', key: getReviewHeaderKey(path) }, offset: 0 };
    }

    const line = getRowLine(row);
    return { place: line ? { kind: 'line', path, ...line } : { kind: 'row', key: row.key }, offset };
}

/**
 * The file a place is in.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getReviewPlacePath(place: ReviewPlace) {
    return place.kind === 'line' ? place.path : getReviewRowPath(place.key);
}

export interface FindReviewPositionRowParams {
    readonly position: ReviewPosition;
    readonly rows: readonly ReviewRow[];
    /** Every file in the order they show, those not shown too. */
    readonly order: readonly string[];
}

/** The row a position lands on now, and how far that is from what it asked for. */
export interface ReviewPositionRow extends ReviewRowReplacement {
    /**
     * `arrived`: as near as it can get, the file's lines being there. `fileWaiting`: its header, until they are.
     * `fileMissing`: the file isn't among the rows, the next one standing in.
     */
    readonly landing: 'arrived' | 'fileWaiting' | 'fileMissing';
}

/**
 * Where a position kept lands in the rows there are now: the same row, or the same line of the same file whichever the
 * layout, at the same distance from the top. A line hidden now gives way to the nearest above it (D7); a row gone or a
 * file with no lines at or above it to its header, at the top. A file not among the rows to the next one still there, as
 * in {@link findReplacementRow}; `null` when no file is left.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findReviewPositionRow({
    position,
    rows,
    order,
}: FindReviewPositionRowParams): ReviewPositionRow | null {
    const { place, offset } = position;
    if (place.kind === 'row') {
        const row = rows.find(other => other.key === place.key);
        if (row) {
            // A resolved thread comes back as one line, whatever height the distance was measured against: its top.
            const folded = row.kind === 'thread' && row.placement.thread.isResolved;
            return { row, offset: folded ? Math.max(offset, 0) : offset, landing: 'arrived' };
        }
    }

    const path = getReviewPlacePath(place);
    const start = rows.findIndex(row => row.key === getReviewHeaderKey(path));
    const header = rows[start];
    if (!header) {
        const next = findNextFileHeader({
            key: getReviewHeaderKey(path),
            offset: 0,
            previous: [],
            next: rows,
            order,
        });
        return next && { ...next, landing: 'fileMissing' };
    }

    if (isFileWaiting(rows, start)) {
        return { row: header, offset: 0, landing: 'fileWaiting' };
    }

    const nearest = place.kind === 'line' ? findNearestLineRow(rows, start, place) : null;
    return nearest ? { row: nearest, offset, landing: 'arrived' } : { row: header, offset: 0, landing: 'arrived' };
}

function isFileWaiting(rows: readonly ReviewRow[], header: number) {
    for (let index = header + 1; index < rows.length; index++) {
        const row = rows[index];
        if (!row || row.kind === 'header') {
            break;
        }

        if (row.kind === 'placeholder' || row.kind === 'paused') {
            return true;
        }
    }

    return false;
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

    const place = held ? getRowLine(held) : null;
    const first = next[start + 1] ?? header;
    if (held?.kind === 'tail') {
        const end = next.findIndex(row => row.kind === 'end' && getReviewRowPath(row.key) === path);
        return { row: next[end + 1] ?? first, offset };
    }

    if (!place) {
        return { row: first, offset };
    }

    return { row: findNearestLineRow(next, start, place) ?? first, offset };
}

/**
 * The file's row at the line, or else the nearest above it (D7), a gap counting when it covers the line; `null` when the
 * file shows none at or above it. To the file's end, as a thread's code from further down shows before its gap; of rows
 * starting at the same line, the last.
 */
function findNearestLineRow(rows: readonly ReviewRow[], header: number, place: RowLine) {
    let nearest: ReviewRow | null = null;
    let nearestLine = 0;
    for (let index = header + 1; index < rows.length; index++) {
        const row = rows[index];
        if (!row || row.kind === 'header') {
            break;
        }

        const line = getRowFirstLine(row, place.side);
        if (line !== null && line <= place.line && line >= nearestLine) {
            nearest = row;
            nearestLine = line;
        }
    }

    return nearest;
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

/** A line a comment can start on. */
export interface ReviewCommentLine extends RowLine {
    readonly path: string;
    readonly key: string;
}

/**
 * The line `C` comments on when no thread is focused (D32): the first of the rows from `key` on, on its newer side unless it
 * only has an older one. `null` with no line after it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findCommentLine(rows: readonly ReviewRow[], key: string | null): ReviewCommentLine | null {
    const start = Math.max(
        rows.findIndex(row => row.key === key),
        0,
    );
    for (let index = start; index < rows.length; index++) {
        const row = rows[index];
        const line = row?.kind === 'line' ? getRowLine(row) : null;
        if (row && line) {
            return { ...line, path: getReviewRowPath(row.key), key: row.key };
        }
    }

    return null;
}

export interface ClampCommentRangeParams extends RowLine {
    readonly rows: readonly ReviewRow[];
    readonly path: string;
    /** Where the range is wanted to reach. */
    readonly to: number;
}

/**
 * How far a range from a line reaches towards `to`: within what is shown, on the one side, up to what hides lines from it.
 * GitHub takes a range within a hunk only, and one over lines not on screen would say more than the reader saw (CR73).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function clampCommentRange({ rows, path, side, line, to }: ClampCommentRangeParams): number {
    const header = rows.findIndex(row => row.key === getReviewHeaderKey(path));
    const pieces = new Map<number, number>();
    let piece = 0;
    for (const row of header === -1 ? [] : rows.slice(header + 1)) {
        if (row.kind === 'header') {
            break;
        }

        if (row.kind === 'line') {
            const shown = getLineNumber(row.line, side);
            if (shown !== null) {
                pieces.set(shown, piece);
            }
        } else if (row.kind === 'gap' || row.kind === 'distance' || row.kind === 'fileEnd') {
            piece++;
        }
    }

    const step = Math.sign(to - line);
    let reached = line;
    while (reached !== to && pieces.has(reached + step) && pieces.get(reached + step) === pieces.get(line)) {
        reached += step;
    }

    return reached;
}

/** A line of a file on one side, which no layout changes. */
interface RowLine {
    readonly side: 'before' | 'after';
    readonly line: number;
}

function getRowLine(row: ReviewRow): RowLine | null {
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
        case 'fileEnd':
            return { side: 'after', line: row.lines.start + 1 };
        case 'comment':
            return { side: row.target.side, line: row.target.line };
        default:
            return null;
    }
}

/** Where a row starts on a side, the lines of a gap counted from its first; `null` for a row with no line there. */
function getRowFirstLine(row: ReviewRow, side: RowLine['side']) {
    switch (row.kind) {
        case 'line':
            return getLineNumber(row.line, side);
        case 'gap':
            return side === 'after' ? row.firstLine : row.firstOlderLine;
        default:
            return null;
    }
}

function getLineNumber(line: DiffSplitRow | DiffUnifiedRow, side: RowLine['side']): number | null {
    if (line.layout === 'split') {
        return (side === 'after' ? line.right?.line : line.left?.line) ?? null;
    }

    return side === 'after' ? line.newLine : line.oldLine;
}
