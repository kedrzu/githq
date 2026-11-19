import { expect, test } from 'bun:test';

import { buildSegments } from './buildSegments.js';
import { findCursorSegment } from './findCursorSegment.js';
import type { ReadingPlace, ReadingStopBox } from './ReadingCursor.js';

// A code thread: its excerpt, a comment, its reply band.
const STOPS: readonly ReadingStopBox[] = [
    { key: 'thread', kind: 'comment', top: 0, bottom: 300 },
    { key: 'comment', kind: 'comment', top: 100, bottom: 200 },
];
// A reply sent: the comments grow by 150, the reply band with them.
const GROWN: readonly ReadingStopBox[] = [
    { key: 'thread', kind: 'comment', top: 0, bottom: 450 },
    { key: 'comment', kind: 'comment', top: 100, bottom: 200 },
    { key: 'reply', kind: 'comment', top: 200, bottom: 350 },
];
const ON_BAND: ReadingPlace = { key: 'thread', offset: 200 };

test('the segment of the cursor’s stop holding its offset', () => {
    const segments = buildSegments(STOPS);

    expect(findCursorSegment({ segments, stops: STOPS, cursor: { key: 'thread', offset: 50 } })?.start).toBe(0);
    expect(findCursorSegment({ segments, stops: STOPS, cursor: ON_BAND })?.start).toBe(200);
});

test('content growing inside the stop keeps the cursor on its segment, not on what grew', () => {
    const segments = buildSegments(GROWN);

    expect(findCursorSegment({ segments, stops: GROWN, cursor: ON_BAND })).toEqual({
        key: 'thread',
        kind: 'comment',
        start: 350,
        end: 450,
    });
    expect(findCursorSegment({ segments, stops: GROWN, cursor: { key: 'gone', offset: 0 } })).toBeNull();
});
