/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { createAnchoredListModel } from './createAnchoredListModel.js';
import type { AnchoredListRow } from './createAnchoredListModel.js';

interface Row extends AnchoredListRow {
    pinned?: boolean;
}

test('a user scroll anchors the first row whose bottom is below the viewport top, at its distance from it', () => {
    const model = createModel(rows(100));

    model.captureAnchor(250);
    expect(model.anchor).toEqual({ key: 'r10', offset: 0 });

    model.captureAnchor(255);
    expect(model.anchor).toEqual({ key: 'r10', offset: -5 });

    // The bottom of r9 is exactly at the top: it is out of view, and r10 is the first.
    model.captureAnchor(249.5);
    expect(model.anchor).toEqual({ key: 'r9', offset: -24.5 });
});

test('heights changing above the anchor move the scroll position by exactly their sum, those below not at all', () => {
    const model = createModel(rows(100));
    model.captureAnchor(255);

    model.setMeasuredHeight('r3', 100.25);
    model.setMeasuredHeight('r4', 10);
    expect(model.anchorScrollTop).toBeCloseTo(255 + 75.25 - 15, 9);

    model.setMeasuredHeight('r50', 500);
    expect(model.anchorScrollTop).toBeCloseTo(255 + 75.25 - 15, 9);
    expect(model.anchor).toEqual({ key: 'r10', offset: -5 });
});

test('a measurement reports whether it changes the layout, and a row not in the list keeps its height for later', () => {
    const model = createModel(rows(3));

    expect(model.setMeasuredHeight('r1', 40)).toBe(true);
    expect(model.setMeasuredHeight('r1', 40)).toBe(false);
    expect(model.setMeasuredHeight('later', 90)).toBe(false);
    expect(model.total).toBe(25 + 40 + 25);

    model.setRows([{ key: 'later' }, ...rows(3)]);
    expect(model.total).toBe(90 + 25 + 40 + 25);
});

test('rows added or removed above keep the anchor on its row, at its offset', () => {
    const model = createModel(rows(100));
    model.jumpTo('r50', 30);
    expect(model.anchorScrollTop).toBe(50 * 25 - 30);

    model.setRows([{ key: 'new1' }, { key: 'new2' }, ...rows(100)]);
    expect(model.anchor).toEqual({ key: 'r50', offset: 30 });
    expect(model.anchorScrollTop).toBe(52 * 25 - 30);

    model.setRows(rows(100).slice(10));
    expect(model.anchorScrollTop).toBe(40 * 25 - 30);
});

test("when the anchor's row is gone, the row at its index takes over, never above the viewport's top", () => {
    const model = createModel(rows(100));

    model.jumpTo('r50', 30);
    model.setRows(rows(100).filter(row => row.key !== 'r50'));
    expect(model.anchor).toEqual({ key: 'r51', offset: 30 });

    model.setRows(rows(100));
    model.captureAnchor(52 * 25 + 5);
    expect(model.anchor).toEqual({ key: 'r52', offset: -5 });
    model.setRows(rows(100).filter(row => row.key !== 'r52'));
    expect(model.anchor).toEqual({ key: 'r53', offset: 0 });

    // Past the new end: the last row.
    model.setRows(rows(10));
    expect(model.anchor).toEqual({ key: 'r9', offset: 0 });
});

test('no rows keep the anchor for when its row comes back', () => {
    const model = createModel(rows(100));
    model.jumpTo('r50', 30);

    model.setRows([]);
    expect(model.total).toBe(0);
    expect(model.pinnedAt(0)).toBeNull();
    expect(model.rangeBetween(0, 100)).toEqual({ start: 0, end: 0 });

    model.setRows(rows(100));
    expect(model.anchor).toEqual({ key: 'r50', offset: 30 });
});

test('a jump to an unknown key leaves the anchor', () => {
    const model = createModel(rows(100));
    model.jumpTo('r50', 0);

    expect(model.jumpTo('nope', 10)).toBe(false);
    expect(model.anchor).toEqual({ key: 'r50', offset: 0 });
});

test('the range covers the rows touching the positions, and placed rows sit one on another', () => {
    const model = createModel(rows(100));
    model.setMeasuredHeight('r1', 40.5);

    const range = model.rangeBetween(-100, 70);
    expect(range).toEqual({ start: 0, end: 3 });
    expect(model.placeRows(range).map(placed => [placed.row.key, placed.index, placed.top])).toEqual([
        ['r0', 0, 0],
        ['r1', 1, 25],
        ['r2', 2, 65.5],
    ]);
});

test('the pinned row is the last at or above the top, and the next one pushes it up as it arrives', () => {
    // Pinned: r10 (top 250), r20 (top 500), r30 (top 750); pinned rows are 25 high.
    const model = createModel(rows(40).map((row, index) => ({ ...row, pinned: index % 10 === 0 && index > 0 })));

    expect(model.pinnedAt(249)).toBeNull();
    expect(model.pinnedAt(250)).toMatchObject({ index: 10, pushUp: 0 });
    expect(model.pinnedAt(474)).toMatchObject({ index: 10, pushUp: 0 });
    expect(model.pinnedAt(490)).toMatchObject({ index: 10, pushUp: 15 });
    expect(model.pinnedAt(500)).toMatchObject({ index: 20, pushUp: 0 });
    expect(model.pinnedAt(10_000)).toMatchObject({ index: 30, pushUp: 0 });
});

function rows(count: number): Row[] {
    return Array.from({ length: count }, (_, index) => ({ key: `r${index}` }));
}

function createModel(initial: Row[]) {
    const model = createAnchoredListModel<Row>({
        estimateHeight: () => 25,
        isPinned: row => row.pinned ?? false,
    });
    model.setRows(initial);
    return model;
}
