import { expect, test } from 'bun:test';

import type { AnchoredListViewport } from '../AnchoredList.vue';
import { findNearestShown } from './findNearestShown.js';

/** Scrolled mid-diff: the reading line sits a third down under the 30 px header, at 30 + 270 / 3 = 120. */
const VIEWPORT: AnchoredListViewport = { height: 300, covered: 30, scrolled: 1000, remaining: 1000 };

test('the row crossing the reading line wins, then the nearest of those that count, never one under the header', () => {
    const rows = [
        { row: 'under header', top: 0, bottom: 25 },
        { row: 'above', top: 25, bottom: 100 },
        { row: 'crossing', top: 100, bottom: 130 },
        { row: 'below', top: 130, bottom: 150 },
    ];

    expect(findNearestShown({ rows, viewport: VIEWPORT, pick: row => row })).toBe('crossing');
    expect(findNearestShown({ rows, viewport: VIEWPORT, pick: row => (row === 'crossing' ? null : row) })).toBe(
        'below',
    );
    expect(
        findNearestShown({ rows, viewport: VIEWPORT, pick: row => (row === 'under header' ? row : null) }),
    ).toBeNull();
});
