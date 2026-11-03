/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { formatLogLineHash, parseLogLineHash } from './logLineHash.js';

test('a log line’s hash reads back as it is written, in GitHub’s form', () => {
    expect(formatLogLineHash({ stepNumber: 3, stepLine: 12 })).toBe('#step:3:12');
    expect(parseLogLineHash('#step:3:12')).toEqual({ stepNumber: 3, stepLine: 12 });
});

test('any other hash names no line', () => {
    for (const hash of ['', '#step:3', '#step:a:1', '#step:3:12:4', '#summary-1']) {
        expect(parseLogLineHash(hash)).toBeNull();
    }
});
