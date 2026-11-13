import { expect, test } from 'bun:test';

import type { AnchoredListViewport } from '../AnchoredList.vue';
import { getCursorScroll } from './getCursorScroll.js';

// What shows under the pinned header is 600 px: the band a third from each edge is 240 to 440.
const VIEWPORT: AnchoredListViewport = { height: 640, covered: 40, scrolled: 5000, remaining: 5000 };

test('inside the band a third from either edge the diff stays; past it, it scrolls just enough, the way the cursor went', () => {
    expect(getCursorScroll({ top: 420, bottom: 440, viewport: VIEWPORT, direction: 'down' })).toBe(0);
    expect(getCursorScroll({ top: 430, bottom: 450, viewport: VIEWPORT, direction: 'down' })).toBe(10);
    expect(getCursorScroll({ top: 240, bottom: 260, viewport: VIEWPORT, direction: 'up' })).toBe(0);
    expect(getCursorScroll({ top: 220, bottom: 240, viewport: VIEWPORT, direction: 'up' })).toBe(-20);
    // Never against the way it went.
    expect(getCursorScroll({ top: 100, bottom: 120, viewport: VIEWPORT, direction: 'down' })).toBe(0);
    expect(getCursorScroll({ top: 500, bottom: 520, viewport: VIEWPORT, direction: 'up' })).toBe(0);
});

test('a stop taller than the band is brought to its top, so its start is read first', () => {
    expect(getCursorScroll({ top: 400, bottom: 700, viewport: VIEWPORT, direction: 'down' })).toBe(160);
});

test('near the ends of the diff it scrolls only as far as the list can, the cursor reaching the edge', () => {
    const nearEnd = { ...VIEWPORT, remaining: 30 };
    const nearStart = { ...VIEWPORT, scrolled: 15 };

    expect(getCursorScroll({ top: 600, bottom: 620, viewport: nearEnd, direction: 'down' })).toBe(30);
    expect(getCursorScroll({ top: 60, bottom: 80, viewport: nearStart, direction: 'up' })).toBe(-15);
});
