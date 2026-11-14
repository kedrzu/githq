import type { ReviewFindLine } from './collectFindLines.js';
import type { DiffMatches } from './findDiffMatches.js';

/** A match marked in a line's text, in UTF-16 code units, the end exclusive. */
export interface LineMark {
    readonly start: number;
    readonly end: number;
    /** The match find is on. */
    readonly current: boolean;
}

/** The matches marked in a row of code, by the side of the diff each half shows: a unified row has one of them. */
export interface RowMarks {
    readonly before: readonly LineMark[];
    readonly after: readonly LineMark[];
}

/** Where a row's matches are among a search's, the end exclusive: a row's lines are next to each other. */
export interface RowMatchRange {
    readonly from: number;
    readonly to: number;
}

/** What {@link getRowMarks} reads. */
export interface GetRowMarksParams {
    readonly lines: readonly ReviewFindLine[];
    readonly matches: DiffMatches;
    readonly range: RowMatchRange;
    /** The current match's place in `matches`' lists, `null` for none. */
    readonly current: number | null;
}

/**
 * Each row's matches, by the row's key: built once per search, so that only a row drawn pays for its marks.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function indexRowMatches(lines: readonly ReviewFindLine[], matches: DiffMatches): Map<string, RowMatchRange> {
    const index = new Map<string, RowMatchRange>();
    let key: string | null = null;
    let from = 0;
    for (let at = 0; at < matches.lines.length; at++) {
        const line = lines[matches.lines[at] ?? -1];
        if (line && line.key !== key) {
            if (key !== null) {
                index.set(key, { from, to: at });
            }

            key = line.key;
            from = at;
        }
    }

    if (key !== null) {
        index.set(key, { from, to: matches.lines.length });
    }

    return index;
}

/**
 * The marks of a row's matches, split by side.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getRowMarks({ lines, matches, range, current }: GetRowMarksParams): RowMarks {
    const before: LineMark[] = [];
    const after: LineMark[] = [];
    for (let at = range.from; at < range.to; at++) {
        const line = lines[matches.lines[at] ?? -1];
        const start = matches.starts[at];
        const end = matches.ends[at];
        if (line && start !== undefined && end !== undefined) {
            (line.side === 'before' ? before : after).push({ start, end, current: at === current });
        }
    }

    return { before, after };
}
