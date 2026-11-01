import { assert } from '@nzyme/utils/assert.js';

import { findMatches, prepareMatchTexts } from '@/utils/findMatches.js';

/** Why a line of the command menu was found: what the menu marks, and where on the line. */
export interface CommandMenuMatch {
    /**
     * Where the matched text is on the line. `hidden`: a word the line does not show (an action's keyword), which the
     * menu shows only because it found the line.
     */
    readonly field: 'title' | 'detail' | 'reference' | 'hidden';
    /** The whole text the ranges are in. */
    readonly text: string;
    /** The matched parts of `text`, as offsets `[start, end, start, end…]`; `null` above 5 typed words. */
    readonly ranges: readonly number[] | null;
}

/** What the menu finds an action or a place by, and what it shows of it. */
export interface MenuRowTexts {
    readonly title: string;
    readonly detail?: string;
    /** Other words it is found by. */
    readonly keywords?: readonly string[];
}

/** An action or a place typed text finds. */
export interface FoundMenuRow<T> {
    readonly row: T;
    readonly score: number;
    /** `null` when nothing is typed: every row is listed, none is marked. */
    readonly match: CommandMenuMatch | null;
}

/**
 * The actions or places typed text finds by their titles and keywords, scattered letters too, best first and in
 * list order among equals. Nothing typed lists every row in order.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findMenuRows<T extends MenuRowTexts>(query: string, rows: readonly T[]): FoundMenuRow<T>[] {
    const prepared = prepareMatchTexts(rows, row => [row.title, ...(row.keywords ?? [])]);
    const matches = findMatches(query, prepared, { letters: true });
    if (query.trim() === '') {
        return matches.map(({ row, score }) => ({ row, score, match: null }));
    }

    return matches.map(({ row, score, textIndex, ranges }) => ({
        row,
        score,
        match: toMatch(row, textIndex, ranges),
    }));
}

function toMatch(row: MenuRowTexts, textIndex: number, ranges: readonly number[] | null): CommandMenuMatch {
    if (textIndex === 0) {
        return { field: 'title', text: row.title, ranges };
    }

    const keyword = row.keywords?.[textIndex - 1];
    assert(keyword);
    // A word the line shows anyway (a project's owner) is marked where it stands.
    return { field: keyword === row.detail ? 'detail' : 'hidden', text: keyword, ranges };
}
