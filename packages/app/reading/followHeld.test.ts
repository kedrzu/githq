import { expect, test } from 'bun:test';

import { followHeld } from './followHeld.js';
import { getHeldLine } from './getHeldLine.js';
import type { ReadingSegment } from './ReadingCursor.js';

const A: ReadingSegment = { key: 'a', kind: 'comment', start: 0, end: 100 };
const B: ReadingSegment = { key: 'b', kind: 'row', start: 100, end: 120 };
const C: ReadingSegment = { key: 'c', kind: 'comment', start: 120, end: 900 };
const SEGMENTS = [A, B, C];

test('a held key puts the cursor on the segment holding the reading line', () => {
    expect(followHeld({ segments: SEGMENTS, line: 110, direction: 'down', current: A })).toBe(B);
    expect(followHeld({ segments: SEGMENTS, line: 500, direction: 'down', current: A })).toBe(C);
    expect(followHeld({ segments: SEGMENTS, line: 50, direction: 'up', current: C })).toBe(A);
});

test('a held key never takes the cursor back against the way it goes', () => {
    expect(followHeld({ segments: SEGMENTS, line: 50, direction: 'down', current: B })).toBe(B);
    expect(followHeld({ segments: SEGMENTS, line: 500, direction: 'up', current: B })).toBe(B);
});

test('the reading line starts at the segment’s start going down, its end going up, inside the band', () => {
    const band = { top: 300, bottom: 700 };

    expect(getHeldLine({ segment: B, band: { top: 0, bottom: 400 }, direction: 'down' })).toBe(100);
    expect(getHeldLine({ segment: B, band: { top: 0, bottom: 400 }, direction: 'up' })).toBe(120);
    expect(getHeldLine({ segment: C, band, direction: 'down' })).toBe(300);
    expect(getHeldLine({ segment: C, band, direction: 'up' })).toBe(700);
});
