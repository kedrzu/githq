import { expect, test } from 'bun:test';

import { buildSegments } from './buildSegments.js';
import { findStopOnScreen } from './findStopOnScreen.js';
import { followScroll } from './followScroll.js';
import type { ReadingBand, ReadingPlace, ReadingStopBox } from './ReadingCursor.js';

// A comment, a row, a review holding a code thread's comment with the review's foot after it, a last comment.
const STOPS: readonly ReadingStopBox[] = [
    { key: 'a', kind: 'comment', top: 0, bottom: 100 },
    { key: 'b', kind: 'row', top: 100, bottom: 150 },
    { key: 'review', kind: 'comment', top: 150, bottom: 900 },
    { key: 'thread-comment', kind: 'comment', top: 200, bottom: 800 },
    { key: 'd', kind: 'comment', top: 900, bottom: 1000 },
];
const SEGMENTS = buildSegments(STOPS);
const ON_A: ReadingPlace = { key: 'a', offset: 20 };

test('a scroll leaves the cursor on its segment while any of it shows', () => {
    expect(follow(ON_A, { top: 99, bottom: 500 }, 'down')).toBe(ON_A);
});

test('once its segment is wholly out of sight, the cursor goes to the segment at the edge it left by', () => {
    expect(follow(ON_A, { top: 100, bottom: 960 }, 'down')).toEqual({ key: 'b', offset: 0 });
    // The review's foot, by an offset that tells it from the review's head.
    expect(follow({ key: 'd', offset: 0 }, { top: 40, bottom: 890 }, 'up')).toEqual({ key: 'review', offset: 650 });
});

test('a stop’s head out of sight is out of sight, though its foot below shows', () => {
    // On the review's head, scrolled into the thread's comment: the cursor goes there, not staying on the review.
    expect(follow({ key: 'review', offset: 0 }, { top: 300, bottom: 700 }, 'down')).toEqual({
        key: 'thread-comment',
        offset: 100,
    });
});

test('a segment taller than what shows is the one at either edge, the cursor where the band starts', () => {
    const band = { top: 300, bottom: 700 };

    expect(follow({ key: 'd', offset: 0 }, band, 'up')).toEqual({ key: 'thread-comment', offset: 100 });
    expect(findStopOnScreen({ stops: STOPS, band, edge: 'top' })).toEqual({ key: 'thread-comment', offset: 100 });
    expect(findStopOnScreen({ stops: STOPS, band: { top: 2000, bottom: 2400 }, edge: 'top' })).toBeNull();
});

function follow(cursor: ReadingPlace, band: ReadingBand, direction: 'down' | 'up') {
    return followScroll({ segments: SEGMENTS, stops: STOPS, cursor, band, direction });
}
