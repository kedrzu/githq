import { describe, expect, spyOn, test } from 'bun:test';

import { findLogMatches, findMatchFrom, getMatchRanges, MAX_MATCHES_PER_LINE } from './findLogMatches.js';
import type { JobLogLine, ParsedJobLog } from './parseJobLog.js';

function logOf(texts: readonly string[], stepNumber: number | null = 1): ParsedJobLog {
    const lines = texts.map((text, index): JobLogLine => ({
        number: index + 1,
        time: null,
        text,
        kind: 'plain',
        stepNumber,
        stepLine: index + 1,
    }));
    return { lines, errors: [], steps: [], characters: 0 };
}

describe('findLogMatches', () => {
    test('finds every match of every line, in order, and counts lines and steps', () => {
        const log: ParsedJobLog = {
            ...logOf(['foo foo', 'nothing', 'a foo']),
            lines: [
                ...logOf(['foo foo', 'nothing'], 1).lines,
                ...logOf(['a foo'], 2).lines.map(line => ({ ...line, number: 3 })),
                ...logOf(['foo before any step'], null).lines.map(line => ({ ...line, number: 4 })),
            ],
        };

        const matches = findLogMatches(log, 'foo');

        expect(matches.lines).toEqual([0, 0, 2, 3]);
        expect(matches.starts).toEqual([0, 4, 2, 0]);
        expect(matches.length).toBe(3);
        expect(matches.lineCount).toBe(3);
        expect([...matches.steps]).toEqual([
            [1, 2],
            [2, 1],
        ]);
        expect(matches.capped).toBe(false);
    });

    test('smart case: insensitive in lower case, sensitive with a capital', () => {
        const log = logOf(['Resolve', 'resolve', 'RESOLVE']);

        expect(findLogMatches(log, 'resolve').lines).toEqual([0, 1, 2]);
        expect(findLogMatches(log, 'Resolve').lines).toEqual([0]);
    });

    test('the query is plain text, never a pattern', () => {
        const log = logOf(['anything', 'a.*(b', 'a{1000}', 'aaaa', '<b>bold</b>']);

        expect(findLogMatches(log, '.*(').lines).toEqual([1]);
        expect(findLogMatches(log, 'a{1000}').lines).toEqual([2]);
        expect(findLogMatches(log, '<b>').lines).toEqual([4]);
    });

    test('matches do not overlap', () => {
        expect(findLogMatches(logOf(['aaaa']), 'aa').starts).toEqual([0, 2]);
    });

    test('an empty query finds nothing', () => {
        expect(findLogMatches(logOf(['text']), '').lines).toEqual([]);
    });

    test('a character that lowers to two keeps the offsets of what follows', () => {
        const matches = findLogMatches(logOf(['İİ target']), 'target');

        expect(matches.starts).toEqual([3]);
    });

    test('a line of a million characters counts up to the cap, and says so', () => {
        const indexOf = spyOn(String.prototype, 'indexOf');
        const matches = findLogMatches(logOf(['a'.repeat(1_000_000)]), 'a');
        const calls = indexOf.mock.calls.length;
        indexOf.mockRestore();

        expect(matches.lines).toHaveLength(MAX_MATCHES_PER_LINE);
        expect(matches.capped).toBe(true);
        expect(calls).toBeLessThanOrEqual(MAX_MATCHES_PER_LINE + 1);
    });

    test('100,000 lines: each line is read once, and looked through once per match and once to end it', () => {
        const count = 100_000;
        let reads = 0;
        const lines = Array.from({ length: count }, (_, index): JobLogLine => {
            const text = index % 2 === 0 ? `line ${index} of the log` : `other ${index}`;
            return {
                number: index + 1,
                time: null,
                get text() {
                    reads++;
                    return text;
                },
                kind: 'plain',
                stepNumber: 1,
                stepLine: index + 1,
            };
        });
        const log: ParsedJobLog = { lines, errors: [], steps: [], characters: 0 };
        const indexOf = spyOn(String.prototype, 'indexOf');

        const matches = findLogMatches(log, 'line');
        const calls = indexOf.mock.calls.length;
        indexOf.mockRestore();

        expect(reads).toBe(count);
        expect(matches.lines).toHaveLength(count / 2);
        expect(calls).toBe(count + count / 2);
    });
});

describe('findMatchFrom', () => {
    test('the first match at or after a line, none past the last', () => {
        const matches = findLogMatches(logOf(['x', 'a', 'x x', 'a', 'x']), 'x');

        expect(findMatchFrom(matches, 0)).toBe(0);
        expect(findMatchFrom(matches, 1)).toBe(1);
        expect(findMatchFrom(matches, 3)).toBe(3);
        expect(findMatchFrom(matches, 5)).toBeNull();
    });
});

describe('getMatchRanges', () => {
    test('a line’s ranges, the current one marked, none in a line with no match', () => {
        const matches = findLogMatches(logOf(['foo foo', 'none', 'foo']), 'foo');

        expect(getMatchRanges(matches, 0, 1)).toEqual([
            { start: 0, end: 3, current: false },
            { start: 4, end: 7, current: true },
        ]);
        expect(getMatchRanges(matches, 1, 1)).toEqual([]);
        expect(getMatchRanges(matches, 2, 1)).toEqual([{ start: 0, end: 3, current: false }]);
    });
});
