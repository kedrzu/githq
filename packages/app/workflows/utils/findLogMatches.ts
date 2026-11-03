import type { LogTextRange } from './getLogLineParts.js';
import type { ParsedJobLog } from './parseJobLog.js';

/** A search's matches in a job's log, in the log's order, as parallel lists: a log can hold millions of them. */
export interface LogMatches {
    /** How long each match is, in UTF-16 code units. */
    readonly length: number;
    /** The index in the log's `lines` of each match's line. */
    readonly lines: readonly number[];
    /** Where each match starts in its line's `text`. */
    readonly starts: readonly number[];
    /** How many lines have a match. */
    readonly lineCount: number;
    /** Some line had more than {@link MAX_MATCHES_PER_LINE}: `lines.length` says how many at least. */
    readonly capped: boolean;
    /** How many matches each step has, by its number; a step with none is not here. */
    readonly steps: ReadonlyMap<number, number>;
}

/**
 * How many matches of one line count. A line of a million `a`s searched for "a" would otherwise put a million marks in
 * the DOM once it shows whole, and as many entries here.
 */
export const MAX_MATCHES_PER_LINE = 1000;

/**
 * Finds a query in every line's `text`, folded steps included. The query is plain text, never a pattern, so nothing in
 * it can make the search slower than one pass over the log. Smart case: case-insensitive unless the query has a capital.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function findLogMatches(log: ParsedJobLog, query: string): LogMatches {
    const sensitive = query !== query.toLowerCase();
    const lines: number[] = [];
    const starts: number[] = [];
    const steps = new Map<number, number>();
    let lineCount = 0;
    let capped = false;
    if (query.length > 0) {
        for (const [index, line] of log.lines.entries()) {
            const { text } = line;
            const haystack = sensitive ? text : toLowerKeepingOffsets(text);
            let count = 0;
            let start = haystack.indexOf(query);
            while (start !== -1 && count < MAX_MATCHES_PER_LINE) {
                lines.push(index);
                starts.push(start);
                count++;
                start = haystack.indexOf(query, start + query.length);
            }

            if (count > 0) {
                lineCount++;
                capped ||= start !== -1;
                if (line.stepNumber !== null) {
                    steps.set(line.stepNumber, (steps.get(line.stepNumber) ?? 0) + count);
                }
            }
        }
    }

    return { length: query.length, lines, starts, lineCount, capped, steps };
}

/**
 * The first match at or after a line, by its position in the matches; `null` past the last. One step of a binary search,
 * as this is asked for every row in view.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function findMatchFrom(matches: LogMatches, index: number): number | null {
    const { lines } = matches;
    let low = 0;
    let high = lines.length;
    while (low < high) {
        const middle = (low + high) >> 1;
        if ((lines[middle] ?? 0) < index) {
            low = middle + 1;
        } else {
            high = middle;
        }
    }

    return low < lines.length ? low : null;
}

/**
 * The ranges to highlight in a line, the one at the position `current` standing out.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getMatchRanges(matches: LogMatches, index: number, current: number | null): LogTextRange[] {
    const { lines, starts, length } = matches;
    const ranges: LogTextRange[] = [];
    const first = findMatchFrom(matches, index);
    if (first === null) {
        return ranges;
    }

    for (let position = first; lines[position] === index; position++) {
        const start = starts[position] ?? 0;
        ranges.push({ start, end: start + length, current: position === current });
    }

    return ranges;
}

/** Lower case at the same offsets: U+0130 alone lowers to two code units, and a match must mark the text it is in. */
function toLowerKeepingOffsets(text: string) {
    const lowered = text.toLowerCase();
    return lowered.length === text.length ? lowered : text.replaceAll('İ', 'i').toLowerCase();
}
