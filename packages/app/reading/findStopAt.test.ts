import { expect, test } from 'bun:test';

import { findStopAt } from './findStopAt.js';
import type { ReadingStopBox } from './ReadingCursor.js';

// A review card holding a code thread's comment, then a gap, then a comment.
const REVIEW: ReadingStopBox = { key: 'review', kind: 'comment', top: 0, bottom: 300 };
const THREAD_COMMENT: ReadingStopBox = { key: 'thread-comment', kind: 'comment', top: 100, bottom: 200 };
const COMMENT: ReadingStopBox = { key: 'comment', kind: 'comment', top: 340, bottom: 400 };
const STOPS = [REVIEW, THREAD_COMMENT, COMMENT];

test('the innermost stop holding the position, as closest() finds for the pointer', () => {
    expect(findStopAt(STOPS, 50)).toBe(REVIEW);
    expect(findStopAt(STOPS, 100)).toBe(THREAD_COMMENT);
    expect(findStopAt(STOPS, 250)).toBe(REVIEW);
    expect(findStopAt(STOPS, 340)).toBe(COMMENT);
});

test('in a gap, the last stop starting above it; above every stop, none', () => {
    expect(findStopAt(STOPS, 320)).toBe(THREAD_COMMENT);
    expect(findStopAt([COMMENT], 500)).toBe(COMMENT);
    expect(findStopAt([COMMENT], 300)).toBeNull();
});
