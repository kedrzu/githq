import { expect, test } from 'bun:test';

import { createThreadRowSample, sampleThread } from '@/testing/sampleThreads.js';

import type { ReviewRow } from '../buildReviewRows.js';
import { findThreadFromRow, listWalkedThreads } from './walkThreads.js';

const OPEN_1 = threadRow('open1');
const SETTLED_1 = threadRow('settled1', true);
const OPEN_2 = threadRow('open2');
const SETTLED_2 = threadRow('settled2', true);
const MIDDLE: ReviewRow = { kind: 'end', key: 'middle', collapsed: false };
const ROWS: readonly ReviewRow[] = [OPEN_1, SETTLED_1, MIDDLE, SETTLED_2, OPEN_2];

test('the walk is every open thread in diff order, then every resolved one', () => {
    expect(listWalkedThreads(ROWS)).toEqual([OPEN_1, OPEN_2, SETTLED_1, SETTLED_2]);
});

test('from a row being read an open thread comes first, however far, then a resolved one; the row itself counts as above', () => {
    expect(findThreadFromRow({ rows: ROWS, key: 'middle', delta: 1 })).toBe(OPEN_2);
    expect(findThreadFromRow({ rows: ROWS, key: 'middle', delta: -1 })).toBe(OPEN_1);
    expect(findThreadFromRow({ rows: ROWS, key: OPEN_1.key, delta: -1 })).toBe(OPEN_1);

    const onlySettledBelow: readonly ReviewRow[] = [OPEN_1, MIDDLE, SETTLED_1, SETTLED_2];
    expect(findThreadFromRow({ rows: onlySettledBelow, key: 'middle', delta: 1 })).toBe(SETTLED_1);
    const onlySettledAbove: readonly ReviewRow[] = [SETTLED_1, SETTLED_2, MIDDLE, OPEN_1];
    expect(findThreadFromRow({ rows: onlySettledAbove, key: 'middle', delta: -1 })).toBe(SETTLED_2);
});

test('nothing lies beyond the first and the last thread: the walk does not wrap', () => {
    expect(findThreadFromRow({ rows: ROWS, key: OPEN_2.key, delta: 1 })).toBeNull();
    expect(findThreadFromRow({ rows: [MIDDLE, OPEN_1], key: 'middle', delta: -1 })).toBeNull();
});

function threadRow(id: string, isResolved = false) {
    return createThreadRowSample({ kind: 'gone', diffHunk: '', thread: sampleThread({ id, isResolved }) });
}
