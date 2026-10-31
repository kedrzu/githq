/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { formatTimeAgo } from './formatTimeAgo.js';

const NOW = Date.parse('2026-10-30T12:00:00Z');

test('a time ago reads in words, in its largest whole unit', () => {
    expect(formatTimeAgo(NOW - 20_000, NOW)).toBe('now');
    expect(formatTimeAgo(NOW - 20 * 60_000, NOW)).toBe('20 minutes ago');
    expect(formatTimeAgo(NOW - 26 * 3_600_000, NOW)).toBe('yesterday');
    expect(formatTimeAgo(NOW - 3 * 86_400_000, NOW)).toBe('3 days ago');
    expect(formatTimeAgo(NOW - 400 * 86_400_000, NOW)).toBe('last year');
});
