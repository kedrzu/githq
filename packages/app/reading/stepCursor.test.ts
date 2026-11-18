import { expect, test } from 'bun:test';

import { findStopAt } from './findStopAt.js';
import type { ReadingStopBox } from './ReadingCursor.js';
import { stepCursor } from './stepCursor.js';

// Short rows, a tall comment, a review holding a code thread's comment and a padding shorter than a line after it, a
// push holding a commit and a toolbar after it.
const STOPS: readonly ReadingStopBox[] = [
    { key: 'description', kind: 'comment', top: 0, bottom: 30 },
    { key: 'event', kind: 'row', top: 30, bottom: 50 },
    { key: 'tall', kind: 'comment', top: 50, bottom: 250 },
    { key: 'review', kind: 'comment', top: 260, bottom: 385 },
    { key: 'thread-comment', kind: 'comment', top: 300, bottom: 360 },
    { key: 'push', kind: 'row', top: 400, bottom: 520 },
    { key: 'commit', kind: 'row', top: 410, bottom: 430 },
];

test('↓ from the top reaches every stop by a press of its own, a tall one taking several, and stays on the last', () => {
    // The gap after the tall comment crossed in the press reaching it. From the code thread's comment straight to the push: the review's padding after it is no stop; the push's
    // toolbar, a line or more, is.
    expect(walk(1)).toEqual([
        'description',
        'event',
        'tall',
        'tall',
        'tall',
        'tall',
        'tall',
        'review',
        'thread-comment',
        'thread-comment',
        'push',
        'commit',
        'push',
        'push',
        'push',
    ]);
});

test('↑ from the end reaches every stop by a press of its own too, a tall one read back through', () => {
    expect(walk(-1, 519)).toEqual([
        'push',
        'push',
        'push',
        'commit',
        'push',
        'thread-comment',
        'thread-comment',
        'thread-comment',
        'review',
        'tall',
        'tall',
        'tall',
        'tall',
        'tall',
        'tall',
        'event',
        'description',
    ]);
});

test('a held key goes further a press inside a stop, still stopping at the next stop’s top', () => {
    expect(stepCursor({ stops: STOPS, y: 50, distance: 120, by: 'line' })).toBe(170);
    expect(stepCursor({ stops: STOPS, y: 50, distance: 240, by: 'line' })).toBe(260);
});

test('↓ crosses a gap between stops wider than a line in one press, the cursor held at its stop as the screen holds it', () => {
    // The description, then a push's header (no stop) and its commit.
    const stops: readonly ReadingStopBox[] = [
        { key: 'description', kind: 'comment', top: 0, bottom: 90 },
        { key: 'commit', kind: 'row', top: 140, bottom: 165 },
    ];
    // The cursor at the description's last line, where its offset is clamped to.
    expect(stepCursor({ stops, y: 89, distance: 40, by: 'line' })).toBe(140);
    expect(stepCursor({ stops, y: 40, distance: 40, by: 'line' })).toBe(80);
});

test('a page passes stops, and stops at the content’s ends', () => {
    expect(stepCursor({ stops: STOPS, y: 10, distance: 300, by: 'page' })).toBe(310);
    expect(stepCursor({ stops: STOPS, y: 300, distance: 300, by: 'page' })).toBe(519);
    expect(stepCursor({ stops: STOPS, y: 100, distance: -300, by: 'page' })).toBe(0);
});

/** The stop the cursor starts on, then the one it is on after each press of 40 px, until a press moves it no more. */
function walk(direction: 1 | -1, start = 0) {
    const visited = [findStopAt(STOPS, start)!.key];
    let y = start;
    for (let press = 0; press < 30; press++) {
        const next = stepCursor({ stops: STOPS, y, distance: direction * 40, by: 'line' });
        if (next === y) {
            break;
        }

        visited.push(findStopAt(STOPS, next)!.key);
        y = next;
    }

    return visited;
}
