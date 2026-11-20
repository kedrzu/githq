import { expect, test } from 'bun:test';

import { buildSegments } from './buildSegments.js';
import type { ReadingSegment, ReadingStopBox } from './ReadingCursor.js';

// Short rows, a tall comment with a short gap after it, a review holding a code thread holding two comments (the
// thread's reply band after them, the review's padding after that), a push holding a commit, a closing event.
const STOPS: readonly ReadingStopBox[] = [
    { key: 'description', kind: 'comment', top: 0, bottom: 30 },
    { key: 'event', kind: 'row', top: 30, bottom: 50 },
    { key: 'tall', kind: 'comment', top: 50, bottom: 250 },
    { key: 'review', kind: 'comment', top: 260, bottom: 500 },
    { key: 'thread', kind: 'comment', top: 300, bottom: 490 },
    { key: 'c1', kind: 'comment', top: 340, bottom: 400 },
    { key: 'c2', kind: 'comment', top: 400, bottom: 440 },
    { key: 'push', kind: 'row', top: 500, bottom: 620 },
    { key: 'commit', kind: 'row', top: 510, bottom: 530 },
    { key: 'closed', kind: 'row', top: 620, bottom: 640 },
];

test('the content cut at every stop’s edges, each piece the innermost stop’s, without a break', () => {
    const expected: ReadingSegment[] = [
        { key: 'description', kind: 'comment', start: 0, end: 30 },
        // Short, but a stop of its own.
        { key: 'event', kind: 'row', start: 30, end: 50 },
        // With the gap after it: the stop above a gap holds it.
        { key: 'tall', kind: 'comment', start: 50, end: 260 },
        { key: 'review', kind: 'comment', start: 260, end: 300 },
        { key: 'thread', kind: 'comment', start: 300, end: 340 },
        { key: 'c1', kind: 'comment', start: 340, end: 400 },
        { key: 'c2', kind: 'comment', start: 400, end: 440 },
        // The thread's reply band, a line and more, is the thread's again; the review's padding after it joins it.
        { key: 'thread', kind: 'comment', start: 440, end: 500 },
        // The push's header, short but at the push's top.
        { key: 'push', kind: 'row', start: 500, end: 510 },
        { key: 'commit', kind: 'row', start: 510, end: 530 },
        { key: 'push', kind: 'row', start: 530, end: 620 },
        { key: 'closed', kind: 'row', start: 620, end: 640 },
    ];

    expect(buildSegments(STOPS)).toEqual(expected);
});

test('a parent’s tail or a gap shorter than a line joins the segment before it, whoever’s it is', () => {
    const stops: readonly ReadingStopBox[] = [
        { key: 'review', kind: 'comment', top: 0, bottom: 130 },
        { key: 'comment', kind: 'comment', top: 20, bottom: 100 },
        { key: 'event', kind: 'row', top: 160, bottom: 180 },
    ];

    expect(buildSegments(stops)).toEqual([
        { key: 'review', kind: 'comment', start: 0, end: 20 },
        { key: 'comment', kind: 'comment', start: 20, end: 160 },
        { key: 'event', kind: 'row', start: 160, end: 180 },
    ]);
});
