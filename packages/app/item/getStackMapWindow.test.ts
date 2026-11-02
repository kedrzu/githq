/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { getStackMapWindow } from './getStackMapWindow.js';

test('a stack of six or fewer shows whole', () => {
    expect(getStackMapWindow(2, 1)).toEqual({ start: 0, end: 1 });
    expect(getStackMapWindow(6, 5)).toEqual({ start: 0, end: 5 });
});

test('SP31: the sixth of ten shows one before and two after, four earlier and two later folded', () => {
    expect(getStackMapWindow(10, 5)).toEqual({ start: 4, end: 7 });
});

test('at either end, the side with nothing to fold gives its line to one more row', () => {
    expect(getStackMapWindow(10, 0)).toEqual({ start: 0, end: 4 });
    expect(getStackMapWindow(10, 9)).toEqual({ start: 5, end: 9 });
    expect(getStackMapWindow(10, 8)).toEqual({ start: 5, end: 9 });
});

test('a fold that would hold one pull request shows it as its row instead', () => {
    expect(getStackMapWindow(10, 2)).toEqual({ start: 0, end: 4 });
    expect(getStackMapWindow(10, 6)).toEqual({ start: 5, end: 9 });
    expect(getStackMapWindow(7, 3)).toEqual({ start: 2, end: 6 });
});

test('never more than six lines, and the open one always shows', () => {
    for (let count = 7; count <= 30; count++) {
        for (let current = 0; current < count; current++) {
            const { start, end } = getStackMapWindow(count, current);
            const lines = end - start + 1 + (start > 0 ? 1 : 0) + (end < count - 1 ? 1 : 0);
            expect(lines).toBeLessThanOrEqual(6);
            expect(current).toBeGreaterThanOrEqual(start);
            expect(current).toBeLessThanOrEqual(end);
            expect(start).not.toBe(1);
            expect(end).not.toBe(count - 2);
        }
    }
});
