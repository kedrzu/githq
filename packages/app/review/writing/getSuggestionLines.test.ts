import { expect, test } from 'bun:test';

import { computeFileDiff } from '../diff/computeFileDiff.js';
import { formatSuggestion, getSuggestionLines } from './getSuggestionLines.js';

const UNCHANGED = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`);
const AFTER = UNCHANGED.map((line, index) => (index === 9 ? '    changed\t' : line));
const DIFF = computeFileDiff({
    before: `${UNCHANGED.join('\n')}\n`,
    after: `${AFTER.join('\n')}\n`,
    ignoreWhitespace: false,
});

test('gives the lines as they are, whitespace and all', () => {
    expect(getSuggestionLines({ diff: DIFF, startLine: 9, line: 10, mustBeInHunk: true })).toEqual([
        'line 9',
        '    changed\t',
    ]);
});

test('a new comment gets one only inside a hunk: the change and three lines around it', () => {
    expect(getSuggestionLines({ diff: DIFF, startLine: 7, line: 13, mustBeInHunk: true })).toHaveLength(7);
    expect(getSuggestionLines({ diff: DIFF, startLine: 6, line: 6, mustBeInHunk: true })).toBeNull();
    expect(getSuggestionLines({ diff: DIFF, startLine: 12, line: 14, mustBeInHunk: true })).toBeNull();
});

test('a thread stands on its lines, in a hunk or not; past the file is nothing', () => {
    expect(getSuggestionLines({ diff: DIFF, startLine: 1, line: 1, mustBeInHunk: false })).toEqual(['line 1']);
    expect(getSuggestionLines({ diff: DIFF, startLine: 20, line: 200, mustBeInHunk: false })).toBeNull();
});

test('the fence outlasts any backticks the code holds', () => {
    expect(formatSuggestion(['  a', ' b'])).toBe('```suggestion\n  a\n b\n```');
    expect(formatSuggestion(['```', 'x'])).toBe('````suggestion\n```\nx\n````');
});
