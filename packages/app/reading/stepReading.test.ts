import { expect, test } from 'bun:test';

import { buildSegments } from './buildSegments.js';
import type { ReadingSegment, ReadingStopBox } from './ReadingCursor.js';
import { stepReading } from './stepReading.js';
import type { StepReadingResult } from './stepReading.js';

// What shows is 400 px: a step is 100 px, the lines a third from either edge 133 px in.
const SCREEN = 400;

// A description, a short event, a comment taller than the screen and a short gap, a review holding a code thread
// holding two comments with its reply band after them, a short resolved row, a last comment.
const STOPS: readonly ReadingStopBox[] = [
    { key: 'description', kind: 'comment', top: 0, bottom: 80 },
    { key: 'event', kind: 'row', top: 80, bottom: 100 },
    { key: 'tall', kind: 'comment', top: 100, bottom: 1100 },
    { key: 'review', kind: 'comment', top: 1120, bottom: 1480 },
    { key: 'thread', kind: 'comment', top: 1160, bottom: 1460 },
    { key: 'c1', kind: 'comment', top: 1220, bottom: 1300 },
    { key: 'c2', kind: 'comment', top: 1300, bottom: 1400 },
    { key: 'resolved', kind: 'row', top: 1480, bottom: 1510 },
    { key: 'last', kind: 'comment', top: 1510, bottom: 1700 },
];
const SEGMENTS = buildSegments(STOPS);

test('↓ from the top goes through every segment in turn, scrolling through the tall comment, then to the content’s end', () => {
    const presses = walk({ segments: SEGMENTS, content: 1700, direction: 'down' });

    // Every segment after the first, in order, each by a press of its own.
    expect(unique(presses.map(({ segment }) => segment.start))).toEqual(SEGMENTS.slice(1).map(({ start }) => start));
    expect(presses.map(({ segment }) => segment.key)).toEqual([
        'event',
        'tall',
        'tall',
        'tall',
        'tall',
        'tall',
        'tall',
        'tall',
        'tall',
        'tall',
        'tall',
        'review',
        'thread',
        'c1',
        'c2',
        'thread',
        'resolved',
        'last',
    ]);
    expect(presses.at(-1)?.scrolled).toBe(1300);
});

test('↑ from the end goes back through every segment, reading the tall comment back, to the content’s top', () => {
    const presses = walk({ segments: SEGMENTS, content: 1700, direction: 'up', scrolled: 1300 });

    expect(unique(presses.map(({ segment }) => segment.key))).toEqual([
        'resolved',
        'thread',
        'c2',
        'c1',
        'thread',
        'review',
        'tall',
        'event',
        'description',
    ]);
    expect(presses.at(-1)?.scrolled).toBe(0);
});

test('on a page too short to scroll, ↓ reaches the last segment and ↑ the first', () => {
    const segments = buildSegments([
        { key: 'a', kind: 'comment', top: 0, bottom: 100 },
        { key: 'b', kind: 'row', top: 100, bottom: 120 },
        { key: 'c', kind: 'comment', top: 120, bottom: 300 },
        // Below the line a third from the bottom, where no scroll brings it.
        { key: 'd', kind: 'row', top: 300, bottom: 390 },
    ]);

    const down = walk({ segments, content: 390, direction: 'down' });
    expect(down.map(({ segment }) => segment.key)).toEqual(['b', 'c', 'd']);
    expect(down.every(({ scrolled }) => scrolled === 0)).toBe(true);

    const up = walk({ segments, content: 390, direction: 'up', from: segments.at(-1) });
    expect(up.map(({ segment }) => segment.key)).toEqual(['c', 'b', 'a']);
});

test('a single ↓ on a stop taller than the screen scrolls a step and stays on it', () => {
    const tall = segmentOf('tall');

    expect(press({ current: tall, scrolled: 0, direction: 'down' })).toEqual({ segment: tall, scroll: 100 });
    // No further than brings the next segment's start to the line a third from the bottom.
    const nearNext = press({ current: tall, scrolled: 850, direction: 'down' });
    expect(nearNext.segment).toBe(tall);
    expect(nearNext.scroll).toBeCloseTo(1120 - (850 + (SCREEN * 2) / 3));
});

test('a segment starting above the line a third from the bottom is the next press’s, scrolled into the band', () => {
    // The second comment from 1300 to 1400, the band from 1050 to 1450: brought a third from the bottom.
    const { segment: next, scroll } = press({ current: segmentOf('c1'), scrolled: 1050, direction: 'down' });

    expect(next).toBe(segmentOf('c2'));
    expect(scroll).toBeCloseTo(1400 - 1050 - (SCREEN * 2) / 3);
});

test('a next segment starting less than a pixel past the line is the press’s own, not a scroll the browser drops', () => {
    // Scrolled so that the thread's excerpt starts a third of a pixel below the line a third from the bottom.
    const { segment: next, scroll } = press({
        current: segmentOf('review'),
        scrolled: 1160 - (SCREEN * 2) / 3 - 1 / 3,
        direction: 'down',
    });

    expect(next).toEqual({ key: 'thread', kind: 'comment', start: 1160, end: 1220 });
    expect(scroll).toBe(0);
});

test('a cursor left wholly above the band by a wheel goes on from the segment at the band’s top', () => {
    // On the tall comment, scrolled to the review's head: the next is the thread's excerpt, not the review's head.
    const { segment: next } = press({ current: segmentOf('tall'), scrolled: 1150, direction: 'down' });

    expect(next).toEqual({ key: 'thread', kind: 'comment', start: 1160, end: 1220 });
});

test('↓ past the last segment still scrolls, the last keeping a part in sight', () => {
    const last = segmentOf('last');

    expect(press({ current: last, scrolled: 1250, direction: 'down' })).toEqual({ segment: last, scroll: 50 });
    // Content below the last stop (a footer): no further than leaves a line of it in the band.
    expect(press({ current: last, scrolled: 1650, direction: 'down', content: 2500 })).toEqual({
        segment: last,
        scroll: 10,
    });
});

test('↑ at the first segment still scrolls to the top', () => {
    const first = segmentOf('description');

    expect(press({ current: first, scrolled: 60, direction: 'up' })).toEqual({ segment: first, scroll: -60 });
});

interface PressParams {
    readonly segments?: readonly ReadingSegment[];
    readonly current: ReadingSegment;
    readonly scrolled: number;
    readonly direction: 'down' | 'up';
    /** How tall the content is. */
    readonly content?: number;
}

interface WalkParams {
    readonly segments: readonly ReadingSegment[];
    readonly content: number;
    readonly direction: 'down' | 'up';
    readonly scrolled?: number;
    /** The cursor's segment before the first press, by default the first or last. */
    readonly from?: ReadingSegment;
}

interface Press {
    readonly segment: ReadingSegment;
    /** After the press. */
    readonly scrolled: number;
}

/** A press on a screen of {@link SCREEN} px scrolled so far. */
function press({ segments = SEGMENTS, current, scrolled, direction, content = 1700 }: PressParams): StepReadingResult {
    return stepReading({
        segments,
        current,
        band: { top: scrolled, bottom: scrolled + SCREEN },
        viewport: { height: SCREEN, covered: 0, scrolled, remaining: Math.max(content - SCREEN - scrolled, 0) },
        direction,
    });
}

/**
 * Presses until a press neither moves the cursor nor scrolls, checking that every other press does one or the other
 * and leaves the cursor's segment in the band; the segment and the scroll after each.
 */
function walk({ segments, content, direction, scrolled = 0, from }: WalkParams): Press[] {
    let current = from ?? (direction === 'down' ? segments[0] : segments.at(-1));
    let at = scrolled;
    const presses: Press[] = [];
    for (let count = 0; count < 100 && current; count++) {
        const { segment, scroll } = press({ segments, current, scrolled: at, direction, content });
        if (segment === current && scroll === 0) {
            return presses;
        }

        at += scroll;
        expect(segment.end > at && segment.start < at + SCREEN).toBe(true);
        presses.push({ segment, scrolled: at });
        current = segment;
    }

    throw new Error('The walk never ended.');
}

function segmentOf(key: string) {
    const found = SEGMENTS.find(other => other.key === key);
    if (!found) {
        throw new Error(`No segment ${key}.`);
    }

    return found;
}

function unique(values: readonly (string | number)[]) {
    return values.filter((value, index) => value !== values[index - 1]);
}
