import { expect, test } from 'bun:test';

import { findNextComment } from './findNextComment.js';
import type { ReadingStopBox } from './ReadingCursor.js';

const STOPS: readonly ReadingStopBox[] = [
    { key: 'description', kind: 'comment', top: 0, bottom: 100 },
    { key: 'push', kind: 'row', top: 100, bottom: 200 },
    { key: 'commit', kind: 'row', top: 120, bottom: 140 },
    { key: 'review', kind: 'comment', top: 200, bottom: 500 },
    { key: 'thread-comment', kind: 'comment', top: 300, bottom: 400 },
    { key: 'event', kind: 'row', top: 500, bottom: 520 },
];

test('[ ] step between comments in document order, a review’s code comments right after it, over every row', () => {
    expect(findNextComment({ stops: STOPS, key: 'description', direction: 1 })?.key).toBe('review');
    expect(findNextComment({ stops: STOPS, key: 'review', direction: 1 })?.key).toBe('thread-comment');
    expect(findNextComment({ stops: STOPS, key: 'commit', direction: -1 })?.key).toBe('description');
});

test('none past the first and the last comment', () => {
    expect(findNextComment({ stops: STOPS, key: 'thread-comment', direction: 1 })).toBeNull();
    expect(findNextComment({ stops: STOPS, key: 'description', direction: -1 })).toBeNull();
});
