import { assertNever } from '@nzyme/utils/assertNever.js';

import { buildDiffRows } from './diff/buildDiffRows.js';
import type { DiffLayout, DiffSplitRow, DiffUnifiedRow } from './diff/buildDiffRows.js';
import type { FileDiff } from './diff/computeFileDiff.js';
import type { ReviewFile } from './ReviewFiles.js';

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
    /** The first and last hidden line of the newer version, 1-based. */
    readonly firstLine: number;
    readonly lastLine: number;
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
    | { readonly kind: 'binary' }
    | { readonly kind: 'tooLarge' }
    | { readonly kind: 'failed'; readonly error: Error }
    | { readonly kind: 'lines'; readonly rows: readonly ReviewRow[] };

export interface BuildReviewRowsParams {
    /** In the order they show. */
    readonly files: readonly ReviewFile[];
    readonly getContent: (file: ReviewFile) => ReviewFileContent;
}

/**
 * The flat rows of a review: for each file its pinned header, what shows under it and its end, and room after the last.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildReviewRows({ files, getContent }: BuildReviewRowsParams): ReviewRow[] {
    const rows: ReviewRow[] = [];
    for (const file of files) {
        const content = getContent(file);
        const { path } = file;
        rows.push({ kind: 'header', key: getReviewHeaderKey(path), file });
        switch (content.kind) {
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

        rows.push({ kind: 'end', key: getReviewEndKey(path) });
    }

    const last = files.at(-1);
    if (last) {
        rows.push({ kind: 'tail', key: last.path + KEY_SEPARATOR + 'tail' });
    }

    return rows;
}

/**
 * The rows of a file's diff in a layout. Their keys are unique across files and layouts: the heights an
 * {@link AnchoredList} remembers by key belong to one layout.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildFileLineRows(path: string, diff: FileDiff, layout: DiffLayout): ReviewRow[] {
    return buildDiffRows(diff, { layout, context: CONTEXT_LINES }).map((row): ReviewRow => {
        const key = path + KEY_SEPARATOR + row.key + KEY_SEPARATOR + layout;
        return row.kind === 'gap'
            ? {
                  kind: 'gap',
                  key,
                  hidden: row.hidden,
                  firstLine: row.range.afterStart + 1,
                  lastLine: row.range.afterEnd,
              }
            : { kind: 'line', key, line: row, diff };
    });
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

function getReviewEndKey(path: string) {
    return path + KEY_SEPARATOR + 'end';
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
            return 16;
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

/**
 * The row to hold in place when the one held is gone from the new rows, because the layout or the whitespace setting
 * changed or the file arrived: the same line, or the first after it, of the same file; for anything else the top of
 * what its file now shows; for the room under what was the last file, what now follows that file, which is at the same
 * place. `null` when the row is still there, or its file is gone: the list's own rule then applies.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findReplacementRow(
    key: string,
    previous: readonly ReviewRow[],
    next: readonly ReviewRow[],
): ReviewRow | null {
    if (next.some(row => row.key === key)) {
        return null;
    }

    const path = getReviewRowPath(key);
    const start = next.findIndex(row => row.key === getReviewHeaderKey(path));
    if (start === -1) {
        return null;
    }

    const held = previous.find(row => row.key === key);
    const place = held ? getRowPlace(held) : null;
    const first = next[start + 1] ?? null;
    if (held?.kind === 'tail') {
        return next[next.findIndex(row => row.key === getReviewEndKey(path)) + 1] ?? first;
    }

    if (!place) {
        return first;
    }

    for (let index = start + 1; index < next.length; index++) {
        const row = next[index];
        if (!row || row.kind === 'header') {
            break;
        }

        if (row.kind !== 'end' && reachesPlace(row, place)) {
            return row;
        }
    }

    return first;
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

function reachesPlace(row: ReviewRow, { side, line }: RowPlace) {
    switch (row.kind) {
        case 'line': {
            const number = getLineNumber(row.line, side);
            return number !== null && number >= line;
        }
        case 'gap':
            return side === 'after' && row.lastLine >= line;
        default:
            return false;
    }
}

function getLineNumber(line: DiffSplitRow | DiffUnifiedRow, side: RowPlace['side']): number | null {
    if (line.layout === 'split') {
        return (side === 'after' ? line.right?.line : line.left?.line) ?? null;
    }

    return side === 'after' ? line.newLine : line.oldLine;
}
