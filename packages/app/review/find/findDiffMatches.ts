import { MAX_MATCHES_PER_LINE } from '@/workflows/utils/findLogMatches.js';

/** What searching a line needs to know of it. */
export interface FindLine {
    /** The line's text as drawn: a match's offsets index it. */
    readonly text: string;
    /** Its matches are stepped through; one that isn't counted (a removed line's twin, say) only shows its marks. */
    readonly counted: boolean;
}

/**
 * A search's matches in the lines, in their order, as parallel lists: typed arrays, moved from the worker rather than
 * copied. Offsets are in UTF-16 code units.
 */
export interface DiffMatches {
    /** The index in the searched lines of each match's line. */
    readonly lines: Uint32Array;
    readonly starts: Uint32Array;
    /** Where each match ends, exclusive: a pattern's matches differ in length. */
    readonly ends: Uint32Array;
    /** The positions in the lists above of the matches on counted lines, in order: what next and previous step through. */
    readonly counted: Uint32Array;
    /** Some line had more than {@link MAX_MATCHES_PER_LINE}: the rest of it isn't here. */
    readonly capped: boolean;
}

/**
 * Finds every match of an expression in the lines. An empty match moves on by one code unit, so `a*` ends; a line keeps
 * its first {@link MAX_MATCHES_PER_LINE} matches. A pattern can take exponential time on some text, so this runs in a
 * worker that can be stopped.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findDiffMatches(lines: readonly FindLine[], expression: RegExp): DiffMatches {
    const matchLines: number[] = [];
    const starts: number[] = [];
    const ends: number[] = [];
    const counted: number[] = [];
    let capped = false;
    // A copy, global for sure: `exec` moves `lastIndex`, and without `g` it would find the same match forever.
    const pattern = new RegExp(expression, expression.global ? expression.flags : `${expression.flags}g`);
    for (const [index, line] of lines.entries()) {
        pattern.lastIndex = 0;
        let count = 0;
        let match = pattern.exec(line.text);
        while (match !== null) {
            if (count === MAX_MATCHES_PER_LINE) {
                capped = true;
                break;
            }

            const end = match.index + match[0].length;
            if (line.counted) {
                counted.push(starts.length);
            }

            matchLines.push(index);
            starts.push(match.index);
            ends.push(end);
            count++;
            if (end === match.index) {
                pattern.lastIndex = end + 1;
            }

            match = pattern.exec(line.text);
        }
    }

    return {
        lines: Uint32Array.from(matchLines),
        starts: Uint32Array.from(starts),
        ends: Uint32Array.from(ends),
        counted: Uint32Array.from(counted),
        capped,
    };
}
