import uFuzzy from '@leeoniya/ufuzzy';
import { assert } from '@nzyme/utils/assert.js';

/** What uFuzzy takes for a word's characters, so a word in any script is a word. */
const TERM_SPLIT = "[^\\p{L}\\d']+";
const TERM_SPLIT_REGEX = new RegExp(TERM_SPLIT, 'gu');

/** Words beyond this are still all required, but in no particular order and without ranges: uFuzzy permutes them. */
const MAX_PERMUTED_WORDS = 5;

const MATCHER_OPTIONS = {
    unicode: true,
    interSplit: TERM_SPLIT,
    intraSplit: '\\p{Ll}\\p{Lu}',
    intraBound: '\\p{Ll}\\p{Lu}',
    intraChars: "[\\p{L}\\d']",
    intraContr: "'\\p{L}{1,2}\\b",
};
const MATCHER = new uFuzzy({ ...MATCHER_OPTIONS, intraMode: 1 });
const EXACT_MATCHER = new uFuzzy({ ...MATCHER_OPTIONS, intraMode: 0 });

/** Rows and their texts ready for `findMatches()`; prepare once per list, not per keystroke. */
export interface PreparedMatchTexts<T> {
    readonly rows: readonly T[];
    /** Every text of every row, in list order, latinized and lowercase: each keeps the length of its original. */
    readonly haystacks: string[];
    /** Where each of `haystacks` came from. */
    readonly owners: readonly MatchTextOwner<T>[];
}

/** The row and the position among its texts of one prepared text. */
export interface MatchTextOwner<T> {
    readonly row: T;
    readonly rowIndex: number;
    readonly textIndex: number;
}

/** Options of `findMatches()`. */
export interface FindMatchesOptions {
    /** Also find the typed letters scattered in order ("sts" → "Set status"), below every other match. */
    readonly letters?: boolean;
    /** Tolerate a typo in a word; on by default. Typo search is the slow part of a long list. */
    readonly typos?: boolean;
    /** Keep only this many matching rows, the first in list order, and rank only those. */
    readonly hitLimit?: number;
}

/** A row found by typed text. */
export interface TextMatch<T> {
    readonly row: T;
    /**
     * Higher is better: the whole text 100, its start 80, the start of every typed word in its words 60, anywhere
     * in it 40; else a hit with a typo, 50 when its first range starts a word and 30 when not; letters in order 1–20.
     */
    readonly score: number;
    /** Which of the row's texts this is: its best-scoring one, the earlier on a tie. */
    readonly textIndex: number;
    /** Matched parts of that text, as original offsets `[start, end, start, end…]`; `null` above 5 words. */
    readonly ranges: readonly number[] | null;
}

/**
 * Readies `rows` for `findMatches()`. A row may offer several texts (a title, its keywords); an empty one matches
 * nothing, so a row can keep the position of a text it does not have.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function prepareMatchTexts<T>(
    rows: readonly T[],
    getTexts: (row: T) => readonly string[],
): PreparedMatchTexts<T> {
    const haystacks: string[] = [];
    const owners: MatchTextOwner<T>[] = [];
    for (const [rowIndex, row] of rows.entries()) {
        for (const [textIndex, text] of getTexts(row).entries()) {
            // `latinize` swaps one character for one, and it takes `İ`, the only one lowercase would lengthen.
            haystacks.push(uFuzzy.latinize(text).toLowerCase());
            owners.push({ row, rowIndex, textIndex });
        }
    }

    return { rows, haystacks, owners };
}

/**
 * The rows typed text finds, best first and in list order among equals, with one match per row. Tolerates a typo in
 * a word, any word order, case and diacritics. Punctuation alone matches literally. Nothing typed lists every row
 * in order, unmarked.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function findMatches<T>(
    query: string,
    prepared: PreparedMatchTexts<T>,
    options: FindMatchesOptions = {},
): TextMatch<T>[] {
    const needle = uFuzzy.latinize(query.trim()).toLowerCase();
    if (needle === '') {
        return prepared.rows.map(row => ({ row, score: 0, textIndex: 0, ranges: null }));
    }

    const { letters = false, typos = true, hitLimit = Infinity } = options;
    const matcher = typos ? MATCHER : EXACT_MATCHER;
    const { haystacks, owners } = prepared;

    // Words only: uFuzzy would read a word after ` -` as "must not contain" and a quoted part as exact.
    const terms = needle.replaceAll(TERM_SPLIT_REGEX, ' ').trim();
    const best = new Map<number, TextMatch<T>>();

    const fuzzyHits = findFuzzyHits();
    const hits = capToRows(fuzzyHits.length > 0 ? fuzzyHits : findLiteralHits());
    const ranges = fuzzyHits.length > 0 ? findFuzzyRanges(hits) : findLiteralRanges(hits);
    for (const hit of hits) {
        const haystack = haystacks[hit];
        assert(haystack);
        const hitRanges = ranges?.get(hit) ?? null;
        if (ranges != null && hitRanges == null) {
            // Every word is in it but no order of them fits: `fix fi` in "fix".
            continue;
        }

        keepBest(hit, scoreTier(needle, haystack) ?? scoreTypo(hitRanges, haystack), hitRanges);
    }

    if (letters) {
        addScatteredLetters();
    }

    return [...best.values()].toSorted((a, b) => b.score - a.score);

    /**
     * The texts holding every word, ascending. `outOfOrder` 1 stops uFuzzy at that, before it permutes the words:
     * over every hit of `a e i o u` the permutations alone take 150 ms, so they wait until the hits are capped.
     */
    function findFuzzyHits() {
        if (terms === '') {
            return [];
        }

        const [found] = matcher.search(haystacks, terms, 1, 0);
        return found ?? [];
    }

    function findLiteralHits() {
        const found: number[] = [];
        for (const [hit, haystack] of haystacks.entries()) {
            if (haystack.includes(needle)) {
                found.push(hit);
            }
        }

        return found;
    }

    /** The hits of the first `hitLimit` rows, all of a row's texts with it. Relies on hits ascending. */
    function capToRows(found: readonly number[]) {
        const capped: number[] = [];
        let rowCount = 0;
        let lastRow = -1;
        for (const hit of found) {
            const owner = owners[hit];
            assert(owner);
            if (owner.rowIndex !== lastRow) {
                if (rowCount >= hitLimit) {
                    break;
                }

                rowCount++;
                lastRow = owner.rowIndex;
            }

            capped.push(hit);
        }

        return capped;
    }

    /** Ranges of the given hits; `null` above 5 words, where uFuzzy does not compute them. */
    function findFuzzyRanges(found: number[]) {
        const [, info, order] = matcher.search(haystacks, terms, MAX_PERMUTED_WORDS, Infinity, found);
        if (info == null || order == null) {
            return null;
        }

        // Through `order`, not `info.idx`: when no order of the words fits, uFuzzy returns an empty `info` object.
        const byHit = new Map<number, readonly number[]>();
        for (const position of order) {
            const hit = info.idx[position];
            const hitRanges = info.ranges[position];
            assert(hit);
            assert(hitRanges);
            byHit.set(hit, hitRanges);
        }

        return byHit;
    }

    function findLiteralRanges(found: readonly number[]) {
        const byHit = new Map<number, readonly number[]>();
        for (const hit of found) {
            const haystack = haystacks[hit];
            assert(haystack);
            const start = haystack.indexOf(needle);
            byHit.set(hit, [start, start + needle.length]);
        }

        return byHit;
    }

    /** Scattered letters come last, so they only ever add rows. */
    function addScatteredLetters() {
        const marked = matcher.split(terms).length <= MAX_PERMUTED_WORDS;
        for (const [hit, haystack] of haystacks.entries()) {
            const found = scoreLetters(needle, haystack);
            if (found != null) {
                keepBest(hit, found.score, marked ? found.ranges : null);
            }
        }
    }

    /** Strictly better only: the earlier text wins a tie, and a row keeps its place in the list order. */
    function keepBest(hit: number, score: number, hitRanges: readonly number[] | null) {
        const owner = owners[hit];
        assert(owner);
        const kept = best.get(owner.rowIndex);
        if (kept == null || score > kept.score) {
            best.set(owner.rowIndex, { row: owner.row, score, textIndex: owner.textIndex, ranges: hitRanges });
        }
    }
}

/** How well the typed text literally finds `haystack`, both latinized and lowercase; `null` when it does not. */
function scoreTier(needle: string, haystack: string) {
    if (haystack === needle) {
        return 100;
    }

    if (haystack.startsWith(needle)) {
        return 80;
    }

    const words = haystack.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const typed = needle.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (typed.length > 0 && typed.every(part => words.some(word => word.startsWith(part)))) {
        return 60;
    }

    return haystack.includes(needle) ? 40 : null;
}

/** A hit no tier explains. Its first range at the start of a word reads as the word typed with a slip. */
function scoreTypo(ranges: readonly number[] | null, haystack: string) {
    const start = ranges?.[0];
    if (start == null) {
        return 30;
    }

    return /[\p{L}\p{N}]$/u.test(haystack.slice(Math.max(0, start - 2), start)) ? 30 : 50;
}

/** The typed letters in order, spread out by `gaps` letters in between; touching letters make one range. */
function scoreLetters(needle: string, haystack: string) {
    const ranges: number[] = [];
    let at = 0;
    let gaps = 0;
    for (const letter of needle.replaceAll(' ', '')) {
        const found = haystack.indexOf(letter, at);
        if (found === -1) {
            return null;
        }

        gaps += at === 0 ? 0 : found - at;
        at = found + letter.length;
        if (ranges.at(-1) === found) {
            ranges[ranges.length - 1] = at;
        } else {
            ranges.push(found, at);
        }
    }

    return { score: Math.max(1, 20 - gaps), ranges };
}
