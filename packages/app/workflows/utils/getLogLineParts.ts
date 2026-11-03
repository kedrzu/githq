/** A part of a log line's text, as offsets into it: `start` included, `end` not. */
export interface LogTextRange {
    readonly start: number;
    readonly end: number;
}

/** What of a log line is put on the screen. */
export interface LogLineParts {
    /** Laid out one below the other: a whole line's text a piece at a time; anything else is one. */
    readonly chunks: readonly (readonly LogLinePart[])[];
    /** How many characters past the end of the last part are not shown. */
    readonly hidden: number;
}

/** A run of a log line's text. */
export interface LogLinePart {
    readonly text: string;
    readonly highlighted: boolean;
    /** A bidi or invisible character, by its code point: what to show for it. The part is that one character. */
    readonly control?: string;
}

/** How a line is cut into parts. */
export interface GetLogLinePartsOptions {
    /** What to highlight, sorted and apart; past the cut only a whole line shows it. */
    readonly ranges?: readonly LogTextRange[];
    /** Past {@link MAX_SHOWN_CHARACTERS} too. */
    readonly whole?: boolean;
}

/**
 * How much of one line is laid out unless asked for: a line of a million characters costs more than the rest of the
 * view put together, and few read one on a screen.
 */
export const MAX_SHOWN_CHARACTERS = 10_000;

/**
 * How much of a whole line goes in one block. Chromium's layout of one block of mixed scripts grows faster than its
 * text: a million characters took 3.3 s in one block and 0.75 s in blocks of this size, five million 75 s and 3.3 s.
 * The price: a line break at each seam, on screen and in what a selection across one copies.
 */
export const WHOLE_LINE_CHUNK = 100_000;

/**
 * How many bidi and invisible characters of a line get a part of their own. A line can be made of nothing else, and a
 * million elements would stall the page as a million characters don't; past this they show as {@link OVER_THE_LIMIT}.
 */
const MAX_CONTROL_PARTS = 100;
const OVER_THE_LIMIT = '�';

/** Text direction controls, and characters of no width: a line can look other than it copies. */
const CONTROLS = /[​-‏‪-‮⁠⁦-⁩﻿]/gu;

/**
 * A log line's text cut to what is shown and split at the ranges to highlight and at its bidi and invisible characters,
 * so that those show as what they are, and act on nothing beyond themselves.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getLogLineParts(text: string, options: GetLogLinePartsOptions = {}): LogLineParts {
    const { ranges = [], whole = false } = options;
    const shown = whole ? text.length : getSafeEnd(text, MAX_SHOWN_CHARACTERS);
    const chunks: LogLinePart[][] = [];
    let controlParts = 0;
    let from = 0;
    do {
        const to = getSafeEnd(text, Math.min(from + WHOLE_LINE_CHUNK, shown));
        chunks.push(getChunk(from, to));
        from = to;
    } while (from < shown);

    return { chunks, hidden: text.length - shown };

    function getChunk(start: number, end: number) {
        const parts: LogLinePart[] = [];
        let at = start;
        for (const range of ranges) {
            if (range.end > start) {
                if (range.start >= end) {
                    break;
                }

                const rangeStart = Math.max(range.start, start);
                pushParts(parts, text.slice(at, rangeStart), false);
                at = Math.min(range.end, end);
                pushParts(parts, text.slice(rangeStart, at), true);
            }
        }

        pushParts(parts, text.slice(at, end), false);
        return parts;
    }

    function pushParts(parts: LogLinePart[], run: string, highlighted: boolean) {
        let at = 0;
        for (const { index, 0: control } of run.matchAll(CONTROLS)) {
            if (controlParts === MAX_CONTROL_PARTS) {
                break;
            }

            controlParts++;
            if (index > at) {
                parts.push({ text: run.slice(at, index), highlighted });
            }

            parts.push({
                text: control,
                highlighted,
                control: `U+${control.codePointAt(0)?.toString(16).toUpperCase()}`,
            });
            at = index + control.length;
        }

        if (at < run.length) {
            const rest = run.slice(at);
            parts.push({
                text: controlParts === MAX_CONTROL_PARTS ? rest.replaceAll(CONTROLS, OVER_THE_LIMIT) : rest,
                highlighted,
            });
        }
    }
}

/** `end`, or the one before it where it would part a surrogate pair. */
function getSafeEnd(text: string, end: number) {
    if (end >= text.length) {
        return text.length;
    }

    return (text.codePointAt(end - 1) ?? 0) > 0xffff ? end - 1 : end;
}
