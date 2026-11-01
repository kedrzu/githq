import { assert } from '@nzyme/utils/assert.js';

import { findMatches, prepareMatchTexts } from '@/utils/findMatches.js';
import type { PreparedMatchTexts } from '@/utils/findMatches.js';

/** What a list's option is found by, and the heading it sits under. */
export interface FilterableOption {
    readonly label: string;
    readonly detail?: string;
    readonly group?: string;
}

/** An option typed text finds. */
export interface FoundOption<T> {
    readonly option: T;
    /** Higher is better; a detail counts {@link DETAIL_PENALTY} below the same match in a label. */
    readonly score: number;
    /** Which of its texts holds the match; `null` when nothing is typed. */
    readonly field: 'label' | 'detail' | null;
    /** The matched parts of that text, as offsets `[start, end, start, end…]`; `null` when unmarked. */
    readonly ranges: readonly number[] | null;
}

/** An option typed text finds by its label alone. */
export interface FoundOptionLabel<T> {
    readonly option: T;
    readonly score: number;
    /** The matched parts of the label, as offsets `[start, end, start, end…]`; `null` when unmarked. */
    readonly ranges: readonly number[] | null;
}

/** The texts of a list of options, by each option's position in it. */
interface PreparedOptions {
    readonly labels: PreparedMatchTexts<number>;
    readonly details: PreparedMatchTexts<number>;
}

/** A label says what an option is; its detail only says more, so the same match in the label outranks it. */
const DETAIL_PENALTY = 30;

/**
 * A list longer than this is the local copy's items ("Add items to project"): to stay inside a frame, a query ranks
 * only the first this many hits, and, as item titles are, it is not searched for scattered letters.
 */
const LONG_LIST_SIZE = 1000;

/** The texts per options array: readying the longest lists is too slow to repeat per keystroke. */
const PREPARED_OPTIONS = new WeakMap<readonly FilterableOption[], PreparedOptions>();

/**
 * The options typed text finds: rows rank within their group, and the group holding the best match comes first, so
 * the first row is the best match and no heading repeats. Scattered letters count in a label only, and not in a long
 * list. Nothing typed lists the options as given. An array is read once: pass a new one when its options change.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function filterOptions<T extends FilterableOption>(query: string, options: readonly T[]): FoundOption<T>[] {
    if (query.trim() === '') {
        return options.map(option => ({ option, score: 0, field: null, ranges: null }));
    }

    const { labels, details } = prepareOptions(options);
    const found = new Map<number, FoundOption<T>>();
    for (const { row, score, ranges } of findMatches(query, details, { hitLimit: LONG_LIST_SIZE })) {
        found.set(row, { option: getOption(options, row), score: score - DETAIL_PENALTY, field: 'detail', ranges });
    }

    const letters = options.length <= LONG_LIST_SIZE;
    for (const { row, score, ranges } of findMatches(query, labels, { letters, hitLimit: LONG_LIST_SIZE })) {
        const inDetail = found.get(row);
        if (inDetail == null || score >= inDetail.score) {
            found.set(row, { option: getOption(options, row), score, field: 'label', ranges });
        }
    }

    // By position among equals: the list's own order.
    const ranked = [...found.entries()].toSorted(([a, foundA], [b, foundB]) => foundB.score - foundA.score || a - b);
    const byGroup = new Map<string | undefined, FoundOption<T>[]>();
    for (const [, row] of ranked) {
        const group = byGroup.get(row.option.group);
        if (group) {
            group.push(row);
        } else {
            byGroup.set(row.option.group, [row]);
        }
    }

    return [...byGroup.values()].flat();
}

/**
 * The options typed text finds by their labels, not scattered, best first and in list order among equals: what an
 * action's options are found by outside its submenu. Shares `filterOptions()`'s prepared texts and its long list cap;
 * a long list takes no typo here.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findOptionLabels<T extends FilterableOption>(
    query: string,
    options: readonly T[],
): FoundOptionLabel<T>[] {
    // A long list is items, which the menu's items already find with a typo: searching them twice costs the frame.
    const typos = options.length <= LONG_LIST_SIZE;
    return findMatches(query, prepareOptions(options).labels, { typos, hitLimit: LONG_LIST_SIZE }).map(
        ({ row, score, ranges }) => ({ option: getOption(options, row), score, ranges }),
    );
}

function prepareOptions(options: readonly FilterableOption[]) {
    const kept = PREPARED_OPTIONS.get(options);
    if (kept) {
        return kept;
    }

    const positions = [...options.keys()];
    const prepared: PreparedOptions = {
        labels: prepareMatchTexts(positions, position => [options[position]?.label ?? '']),
        details: prepareMatchTexts(positions, position => [options[position]?.detail ?? '']),
    };
    PREPARED_OPTIONS.set(options, prepared);
    return prepared;
}

function getOption<T>(options: readonly T[], position: number) {
    const option = options[position];
    assert(option);
    return option;
}
