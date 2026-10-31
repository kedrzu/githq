/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { formatAge } from './formatAge.js';

const NOW = Date.parse('2026-10-30T12:00:00Z');

test('an age reads in its largest whole unit, weeks up to a year', () => {
    expect(formatAge(NOW - 30_000, NOW)).toBe('now');
    expect(formatAge(NOW - 12 * 60_000, NOW)).toBe('12m');
    expect(formatAge(NOW - 3.5 * 3_600_000, NOW)).toBe('3h');
    expect(formatAge(NOW - 2 * 86_400_000, NOW)).toBe('2d');
    expect(formatAge(NOW - 40 * 86_400_000, NOW)).toBe('5w');
    expect(formatAge(NOW - 800 * 86_400_000, NOW)).toBe('2y');
});
