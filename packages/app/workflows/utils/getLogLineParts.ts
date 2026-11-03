/** A part of a log line's text, as offsets into it: `start` included, `end` not. */
export interface LogTextRange {
    readonly start: number;
    readonly end: number;
}

/** What of a log line is put on the screen. */
export interface LogLineParts {
    readonly parts: readonly LogLinePart[];
    /** How many characters past the end of the last part are not shown. */
    readonly hidden: number;
}

/** A run of a log line's text. */
export interface LogLinePart {
    readonly text: string;
    readonly highlighted: boolean;
}

/**
 * How much of one line is laid out at most: a line of a million characters would stall the page, wrapped or not, and
 * nobody reads one on a screen.
 */
export const MAX_SHOWN_CHARACTERS = 10_000;

/**
 * A log line's text cut to what is shown and split at the ranges to highlight, which come sorted and apart.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getLogLineParts(text: string, ranges: readonly LogTextRange[] = []): LogLineParts {
    const shown = Math.min(text.length, MAX_SHOWN_CHARACTERS);
    const parts: LogLinePart[] = [];
    let at = 0;
    for (const { start, end } of ranges) {
        if (start >= shown) {
            break;
        }

        if (start > at) {
            parts.push({ text: text.slice(at, start), highlighted: false });
        }

        at = Math.min(end, shown);
        parts.push({ text: text.slice(start, at), highlighted: true });
    }

    if (at < shown) {
        parts.push({ text: text.slice(at, shown), highlighted: false });
    }

    return { parts, hidden: text.length - shown };
}
