import { expect, test } from 'bun:test';

import { buildSplitPlaceholder, buildUnifiedPlaceholder, getPlaceholderMask } from './getPlaceholderMask.js';
import type { PlaceholderBar } from './getPlaceholderMask.js';

const MODIFIED = { path: 'src/sync/outbox.ts', changeType: 'MODIFIED', rows: 400 } as const;

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
    const mask = getPlaceholderMask({ ...MODIFIED, layout: 'split' });

    expect(mask.startsWith('url("data:image/svg+xml,')).toBe(true);
    expect(decodeURIComponent(mask)).toContain("xmlns='http://www.w3.org/2000/svg'");
    expect(mask.slice('url("'.length, -'")'.length)).not.toMatch(/[<>#"]/u);
    expect(getPlaceholderMask({ ...MODIFIED, layout: 'split' })).toBe(mask);
    expect(getPlaceholderMask({ ...MODIFIED, layout: 'unified' })).not.toBe(mask);
});
