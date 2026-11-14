import { expect, test } from 'bun:test';

import { MAX_MATCHES_PER_LINE } from '@/workflows/utils/findLogMatches.js';

import { compileFindQuery } from './compileFindQuery.js';
import type { FindOptions } from './compileFindQuery.js';
import { findDiffMatches } from './findDiffMatches.js';
import type { FindLine } from './findDiffMatches.js';

const PLAIN: FindOptions = { matchCase: false, wholeWord: false, regex: false };
const REGEX: FindOptions = { ...PLAIN, regex: true };

test('finds every match of every line in order, with the ends of matches that differ in length', () => {
    const matches = find(['ab abbb', 'none', 'abb'], 'ab+', REGEX);

    expect([...matches.lines]).toEqual([0, 0, 2]);
    expect([...matches.starts]).toEqual([0, 3, 0]);
    expect([...matches.ends]).toEqual([2, 7, 3]);
    expect(matches.capped).toBe(false);
});

test('offsets index the text as drawn when ignoring case, even past a letter that lowers to two code units', () => {
    // 'İ'.toLowerCase() is two code units: a search on lowered text would mark one unit to the right of "foo".
    const text = 'İ FOO';

    const matches = find([text], 'foo', PLAIN);

    expect(text.slice(matches.starts[0], matches.ends[0])).toBe('FOO');
});

test('an empty match moves on, so a pattern that can match nothing still ends', () => {
    const matches = find(['ba'], 'a*', REGEX);

    expect([...matches.starts]).toEqual([0, 1, 2]);
    expect([...matches.ends]).toEqual([0, 2, 2]);
});

test('a line keeps its first matches up to the cap and says it was capped', () => {
    const many = find(['a'.repeat(MAX_MATCHES_PER_LINE + 5), 'a'], 'a', PLAIN);
    const exact = find(['a'.repeat(MAX_MATCHES_PER_LINE)], 'a', PLAIN);

    expect(many.lines.length).toBe(MAX_MATCHES_PER_LINE + 1);
    expect(many.lines.at(-1)).toBe(1);
    expect(many.capped).toBe(true);
    expect(exact.lines.length).toBe(MAX_MATCHES_PER_LINE);
    expect(exact.capped).toBe(false);
});

test('lists the positions of the matches on counted lines only', () => {
    const lines: FindLine[] = [
        { text: 'x x', counted: true },
        { text: 'x', counted: false },
        { text: 'x', counted: true },
    ];

    const matches = findDiffMatches(lines, compile('x', PLAIN));

    expect([...matches.lines]).toEqual([0, 0, 1, 2]);
    expect([...matches.counted]).toEqual([0, 1, 3]);
});

function find(texts: readonly string[], query: string, options: FindOptions) {
    return findDiffMatches(
        texts.map(text => ({ text, counted: true })),
        compile(query, options),
    );
}

function compile(query: string, options: FindOptions) {
    const expression = compileFindQuery(query, options);
    if (!(expression instanceof RegExp)) {
        throw new TypeError(`No expression for ${query}`);
    }

    return expression;
}
