/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { formatCheckedAge } from './formatCheckedAge.js';

const NOW = Date.parse('2026-10-30T12:00:00Z');

test('a check reads in seconds under a minute, then as a row age', () => {
    expect(formatCheckedAge(NOW + 5000, NOW)).toBe('0s');
    expect(formatCheckedAge(NOW - 14_500, NOW)).toBe('14s');
    expect(formatCheckedAge(NOW - 59_999, NOW)).toBe('59s');
    expect(formatCheckedAge(NOW - 60_000, NOW)).toBe('1m');
    expect(formatCheckedAge(NOW - 3 * 3_600_000, NOW)).toBe('3h');
});
