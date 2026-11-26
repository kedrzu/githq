import { expect, test } from 'bun:test';

import { assert } from '@nzyme/utils/assert.js';

import { buildSplitPlaceholder, buildUnifiedPlaceholder, getPlaceholderMask } from './getPlaceholderMask.js';
import type { PlaceholderBar } from './getPlaceholderMask.js';

const MODIFIED = { path: 'src/sync/outbox.ts', changeType: 'MODIFIED', rows: 400 } as const;
/** The default Code size and line height. */
const CODE = { codeSize: 12, codeLineHeight: 20 } as const;

test('a file always shows the same lines, and another file other ones', () => {
    expect(buildUnifiedPlaceholder(MODIFIED)).toEqual(buildUnifiedPlaceholder(MODIFIED));
    expect(buildSplitPlaceholder(MODIFIED)).toEqual(buildSplitPlaceholder(MODIFIED));
    expect(buildUnifiedPlaceholder({ ...MODIFIED, path: 'src/sync/pending.ts' })).not.toEqual(
        buildUnifiedPlaceholder(MODIFIED),
    );
});

test('as many rows as asked, in either layout', () => {
    for (const changeType of ['MODIFIED', 'ADDED', 'DELETED'] as const) {
        for (const rows of [3, 17, 2000]) {
            expect(buildUnifiedPlaceholder({ ...MODIFIED, changeType, rows })).toHaveLength(rows);
            expect(buildSplitPlaceholder({ ...MODIFIED, changeType, rows })).toHaveLength(rows);
        }
    }
});

test('lines read like code: lengths 3–72 around 26, indent 0–4, a blank now and then but never two in a row', () => {
    const bars = buildUnifiedPlaceholder({ ...MODIFIED, rows: 2000 });
    const drawn = bars.filter((bar): bar is PlaceholderBar => bar !== null);
    const lengths = drawn.map(bar => bar.length);
    let total = 0;
    for (const length of lengths) {
        total += length;
    }
    const mean = total / lengths.length;

    expect(Math.min(...lengths)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(72);
    expect(mean).toBeGreaterThan(23);
    expect(mean).toBeLessThan(29);
    expect(drawn.every(bar => bar.indent >= 0 && bar.indent <= 4)).toBe(true);
    expect(new Set(drawn.map(bar => bar.indent)).size).toBeGreaterThan(2);

    const blanks = bars.length - drawn.length;
    expect(blanks / bars.length).toBeGreaterThan(0.05);
    expect(blanks / bars.length).toBeLessThan(0.15);
    expect(bars.some((bar, i) => bar === null && bars[i + 1] === null)).toBe(false);
});

test('split: an added file on the right alone, a deleted one on the left alone', () => {
    const added = buildSplitPlaceholder({ ...MODIFIED, changeType: 'ADDED' });
    const deleted = buildSplitPlaceholder({ ...MODIFIED, changeType: 'DELETED' });

    expect(added.every(row => row.before === null)).toBe(true);
    expect(added.some(row => row.after !== null)).toBe(true);
    expect(deleted.every(row => row.after === null)).toBe(true);
    expect(deleted.some(row => row.before !== null)).toBe(true);
});

test('split: the same lines as unified, context mirrored, deleted left beside added right', () => {
    const unified = buildUnifiedPlaceholder(MODIFIED);
    const split = buildSplitPlaceholder(MODIFIED);

    const mirrored = split.filter(row => row.before !== null && row.before === row.after);
    const oneSided = split.filter(row => (row.before === null) !== (row.after === null));
    expect(mirrored.length).toBeGreaterThan(0);
    expect(oneSided.length).toBeGreaterThan(0);

    // Read back in unified order (left, then right of each changed run), split's lines are unified's from the start.
    const readBack: (PlaceholderBar | null)[] = [];
    let before: (PlaceholderBar | null)[] = [];
    let after: (PlaceholderBar | null)[] = [];
    for (const row of split) {
        if (row.before !== null && row.before === row.after) {
            readBack.push(...before, ...after, row.before);
            before = [];
            after = [];
        } else {
            before.push(row.before);
            after.push(row.after);
        }
    }
    // Split takes fewer rows for the same lines, so it reaches further into them.
    const fromSplit = readBack.filter(bar => bar !== null);
    const fromUnified = unified.filter(bar => bar !== null);
    const shared = Math.min(fromSplit.length, fromUnified.length);
    expect(shared).toBeGreaterThan(200);
    expect(fromSplit.slice(0, shared)).toEqual(fromUnified.slice(0, shared));
});

test('the mask is an SVG image the browser takes: namespaced, with nothing left unescaped', () => {
    const mask = getPlaceholderMask({ ...MODIFIED, ...CODE, layout: 'split' });

    expect(mask.startsWith('url("data:image/svg+xml,')).toBe(true);
    expect(decodeURIComponent(mask)).toContain("xmlns='http://www.w3.org/2000/svg'");
    expect(mask.slice('url("'.length, -'")'.length)).not.toMatch(/[<>#"]/u);
    expect(getPlaceholderMask({ ...MODIFIED, ...CODE, layout: 'split' })).toBe(mask);
    expect(getPlaceholderMask({ ...MODIFIED, ...CODE, layout: 'unified' })).not.toBe(mask);
});

test("the bars sit on the Code role's lines, a character 0.6 of its size", () => {
    const bars = buildUnifiedPlaceholder(MODIFIED);
    const index = bars.findIndex(bar => bar !== null && bar.indent > 0);
    const bar = bars[index];
    assert(bar);

    const rect = readRects(getPlaceholderMask({ ...MODIFIED, codeSize: 15, codeLineHeight: 25, layout: 'unified' }))[
        bars.slice(0, index).filter(other => other !== null).length
    ];

    // Unified code starts at 132; an indent level is two characters; the 8 px bar centred in its line.
    expect(rect).toEqual({
        x: Math.round((132 + bar.indent * 2 * 9) * 10) / 10,
        y: index * 25 + 8.5,
        width: Math.round(bar.length * 9 * 10) / 10,
    });
});

function readRects(mask: string) {
    const svg = decodeURIComponent(mask);
    return [...svg.matchAll(/<rect x='([\d.]+)' y='([\d.]+)' width='([\d.]+)'/gu)].map(([, x, y, width]) => ({
        x: Number(x),
        y: Number(y),
        width: Number(width),
    }));
}
