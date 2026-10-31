/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { formatDuration } from './formatDuration.js';

test('a duration reads in its largest unit and the next, seconds two wide after minutes', () => {
    expect(formatDuration(45_000)).toBe('45s');
    expect(formatDuration(134_000)).toBe('2m 14s');
    expect(formatDuration(362_000)).toBe('6m 02s');
    expect(formatDuration(3_900_000)).toBe('1h 5m');
    expect(formatDuration(-5)).toBe('0s');
});
