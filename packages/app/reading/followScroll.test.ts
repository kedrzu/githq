import { expect, test } from 'bun:test';

import { findStopOnScreen } from './findStopOnScreen.js';
import { followScroll } from './followScroll.js';
import type { ReadingCursor, ReadingStopBox } from './ReadingCursor.js';

const STOPS: readonly ReadingStopBox[] = [
    { key: 'a', kind: 'comment', top: 0, bottom: 100 },
    { key: 'b', kind: 'row', top: 100, bottom: 150 },
    { key: 'c', kind: 'comment', top: 150, bottom: 900 },
    { key: 'd', kind: 'comment', top: 900, bottom: 1000 },
];
const ON_A: ReadingCursor = { key: 'a', offset: 20 };

test('a scroll leaves the cursor on its stop while any of it shows', () => {
    expect(followScroll({ stops: STOPS, cursor: ON_A, band: { top: 99, bottom: 500 }, direction: 'down' })).toBe(ON_A);
});

test('once its stop is wholly out of sight, the cursor goes to the stop at the edge it left by', () => {
    const scrolledDown = followScroll({
        stops: STOPS,
        cursor: ON_A,
        band: { top: 100, bottom: 960 },
        direction: 'down',
    });
    const scrolledUp = followScroll({
        stops: STOPS,
        cursor: { key: 'd', offset: 0 },
        band: { top: 40, bottom: 890 },
        direction: 'up',
    });

    expect(scrolledDown).toEqual({ key: 'b', offset: 0 });
    expect(scrolledUp).toEqual({ key: 'b', offset: 0 });
});

test('a stop taller than what shows is the one at either edge, the cursor where the band starts', () => {
    const band = { top: 300, bottom: 700 };

    expect(findStopOnScreen({ stops: STOPS, band, edge: 'top' })).toEqual({ key: 'c', offset: 150 });
    expect(findStopOnScreen({ stops: STOPS, band, edge: 'bottom' })).toEqual({ key: 'c', offset: 150 });
    expect(findStopOnScreen({ stops: STOPS, band: { top: 2000, bottom: 2400 }, edge: 'top' })).toBeNull();
});
