import { expect, test } from 'bun:test';

import { getCommentScroll } from './getCommentScroll.js';
import type { CursorScrollViewport } from './getCursorScroll.js';

// What shows under the pinned header is 600 px: the lines a third from each edge are at 240 and 440.
const VIEWPORT: CursorScrollViewport = { height: 640, covered: 40, scrolled: 5000, remaining: 5000 };

test('a comment whose top is between the third lines stays where it is', () => {
    expect(getCommentScroll(240, VIEWPORT)).toBe(0);
    expect(getCommentScroll(440, VIEWPORT)).toBe(0);
});

test('above or below them, its top goes to the upper third line, whichever way the step went', () => {
    expect(getCommentScroll(441, VIEWPORT)).toBe(201);
    expect(getCommentScroll(1500, VIEWPORT)).toBe(1260);
    expect(getCommentScroll(100, VIEWPORT)).toBe(-140);
    expect(getCommentScroll(-800, VIEWPORT)).toBe(-1040);
});

test('near the content’s ends it scrolls only as far as the content can', () => {
    expect(getCommentScroll(1500, { ...VIEWPORT, remaining: 300 })).toBe(300);
    expect(getCommentScroll(-800, { ...VIEWPORT, scrolled: 100 })).toBe(-100);
});
