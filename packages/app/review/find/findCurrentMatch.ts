import { getReviewRowPath } from '../buildReviewRows.js';
import type { ReviewRow } from '../buildReviewRows.js';
import type { DiffLineSide } from '../diff/buildDiffRows.js';
import type { ReviewFindLine } from './collectFindLines.js';
import type { DiffMatches } from './findDiffMatches.js';

/**
 * A match by what it is in the code, not by where it is drawn: the same in both layouts and through a rebuild of the rows.
 */
export interface FindMatchIdentity {
    readonly path: string;
    readonly side: DiffLineSide;
    /** 1-based, on its side. */
    readonly line: number;
    readonly start: number;
}

/** What {@link findCurrentMatch} looks from. */
export type FindCurrentMatchFrom =
    /** A new query: the first match at or after the cursor's row, `null` for no cursor. */
    | { readonly kind: 'cursor'; readonly cursorKey: string | null }
    /** A new result of the same query: the match find was on, or the first one after it. */
    | { readonly kind: 'kept'; readonly identity: FindMatchIdentity };

export interface FindCurrentMatchParams {
    /** The lines searched and their search's matches. */
    readonly lines: readonly ReviewFindLine[];
    readonly matches: DiffMatches;
    /** The rows the lines were collected from. */
    readonly rows: readonly ReviewRow[];
    readonly from: FindCurrentMatchFrom;
}

/**
 * The match find lands on, as its place among the counted matches, `null` when none is counted. Past the last match it
 * wraps to the first, as stepping does. A match kept but gone (its line changed, a setting hid it) gives way to the first
 * after it by file, then line, then side, then offset: lines of the two sides compare by number, which is near enough for
 * where to go on from.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findCurrentMatch({ lines, matches, rows, from }: FindCurrentMatchParams): number | null {
    if (matches.counted.length === 0) {
        return null;
    }

    return from.kind === 'cursor'
        ? findFromCursor(lines, matches, rows, from.cursorKey)
        : findKept(lines, matches, rows, from.identity);
}

/**
 * The identity of the match at a place among the counted matches.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getMatchIdentity(
    lines: readonly ReviewFindLine[],
    matches: DiffMatches,
    position: number,
): FindMatchIdentity | null {
    const at = matches.counted[position];
    if (at === undefined) {
        return null;
    }

    const line = lines[matches.lines[at] ?? -1];
    const start = matches.starts[at];
    return line && start !== undefined ? { path: line.path, side: line.side, line: line.line, start } : null;
}

function findFromCursor(
    lines: readonly ReviewFindLine[],
    matches: DiffMatches,
    rows: readonly ReviewRow[],
    cursorKey: string | null,
) {
    const cursorIndex = cursorKey === null ? -1 : rows.findIndex(row => row.key === cursorKey);
    if (cursorIndex <= 0) {
        return 0;
    }

    const fromCursor = new Set<string>();
    for (let index = cursorIndex; index < rows.length; index++) {
        fromCursor.add(rows[index]?.key ?? '');
    }

    for (const [position, at] of matches.counted.entries()) {
        const line = lines[matches.lines[at] ?? -1];
        if (line && fromCursor.has(line.key)) {
            return position;
        }
    }

    return 0;
}

function findKept(
    lines: readonly ReviewFindLine[],
    matches: DiffMatches,
    rows: readonly ReviewRow[],
    identity: FindMatchIdentity,
) {
    const fileOrder = new Map<string, number>();
    for (const row of rows) {
        if (row.kind === 'header') {
            fileOrder.set(getReviewRowPath(row.key), fileOrder.size);
        }
    }

    const kept = getOrder(identity, fileOrder);
    let best: number[] | null = null;
    let found = 0;
    for (let position = 0; position < matches.counted.length; position++) {
        const match = getMatchIdentity(lines, matches, position);
        if (!match) {
            continue;
        }

        const key = getOrder(match, fileOrder);
        const fromKept = compareOrder(key, kept);
        if (fromKept === 0) {
            return position;
        }

        if (fromKept > 0 && (best === null || compareOrder(key, best) < 0)) {
            best = key;
            found = position;
        }
    }

    return found;
}

/** Where a match sorts: a file not shown sorts after all. */
function getOrder(match: FindMatchIdentity, fileOrder: ReadonlyMap<string, number>) {
    return [
        fileOrder.get(match.path) ?? Number.POSITIVE_INFINITY,
        match.line,
        match.side === 'before' ? 0 : 1,
        match.start,
    ];
}

function compareOrder(a: readonly number[], b: readonly number[]) {
    for (const [index, value] of a.entries()) {
        const other = b[index] ?? 0;
        if (value !== other) {
            return value < other ? -1 : 1;
        }
    }

    return 0;
}
