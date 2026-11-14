import { expect, test } from 'bun:test';

import { compileFindQuery } from './compileFindQuery.js';
import type { FindOptions } from './compileFindQuery.js';

const PLAIN: FindOptions = { matchCase: false, wholeWord: false, regex: false };

test('an empty query searches for nothing', () => {
    expect(compileFindQuery('', { ...PLAIN, regex: true })).toBeNull();
});

test('a pattern that does not compile is invalid, and plain text never is', () => {
    expect(compileFindQuery('(a', { ...PLAIN, regex: true })).toBe('invalid');
    expect(compileFindQuery('(a', PLAIN)).toBeInstanceOf(RegExp);
});

test('Whole Word does not make a broken pattern compile by wrapping it', () => {
    expect(compileFindQuery('a)|(b', { ...PLAIN, regex: true, wholeWord: true })).toBe('invalid');
});

test('plain text matches literally, ignoring case unless Match Case is on', () => {
    expect(matchesOf('A.B a.b axb', 'a.b', PLAIN)).toEqual(['A.B', 'a.b']);
    expect(matchesOf('A.B a.b axb', 'a.b', { ...PLAIN, matchCase: true })).toEqual(['a.b']);
    expect(matchesOf('A.B a.b axb', 'a.b', { ...PLAIN, regex: true })).toEqual(['A.B', 'a.b', 'axb']);
});

test('Whole Word keeps the matches with no word character on either side, alternatives included', () => {
    expect(matchesOf('cat concat cats cat_ dog', 'cat|dog', { ...PLAIN, regex: true, wholeWord: true })).toEqual([
        'cat',
        'dog',
    ]);
});

function matchesOf(text: string, query: string, options: FindOptions) {
    const expression = compileFindQuery(query, options);
    if (!(expression instanceof RegExp)) {
        throw new TypeError(`No expression for ${query}`);
    }

    return [...text.matchAll(expression)].map(match => match[0]);
}
