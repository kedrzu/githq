/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';

import { createSeededRandom } from '@/testing/createSeededRandom.js';

import { buildDiffRows } from './buildDiffRows.js';
import type { DiffCell, DiffLayout, DiffRow } from './buildDiffRows.js';
import { computeFileDiff } from './computeFileDiff.js';
import type { FileDiff } from './computeFileDiff.js';

const exact = { ignoreWhitespace: false };
const layouts: DiffLayout[] = ['split', 'unified'];

/** `count` numbered lines, each ending in a newline. */
function numbered(count: number): string[] {
    return Array.from({ length: count }, (_, index) => `line ${index + 1}`);
}

function file(lines: readonly string[]): string {
    return lines.map(line => `${line}\n`).join('');
}

describe.each(layouts)('every line once, in %s', layout => {
    test('on random files, with whitespace shown and hidden, at any context', () => {
        const random = createSeededRandom(7);
        for (let round = 0; round < 500; round++) {
            const before = randomLines(random);
            const after = randomLines(random);
            const options = { ignoreWhitespace: round % 2 === 0 };
            const diff = computeFileDiff(before.join('\n'), after.join('\n'), options);
            const rows = buildDiffRows(diff, { layout, context: round % 5 });
            const sides = readSides(rows, diff);

            expect(sides.before).toEqual(diff.before.map((text, index) => ({ line: index + 1, text })));
            expect(sides.after).toEqual(diff.after.map((text, index) => ({ line: index + 1, text })));
            expect(new Set(rows.map(row => row.key)).size).toBe(rows.length);
        }
    });

    for (const [name, before, after] of [
        ['an added file', null, 'a\nb\n'],
        ['a deleted file', 'a\nb\n', null],
        ['empty files', '', ''],
        ['a missing final newline', 'a\nb', 'a\nc'],
        ['CRLF', 'a\r\nb\r\nc\r\n', 'a\r\nB\r\nc\r\n'],
    ] as const) {
        test(`on ${name}`, () => {
            const diff = computeFileDiff(before, after, exact);
            const sides = readSides(buildDiffRows(diff, { layout, context: 3 }), diff);

            expect(sides.before).toEqual(diff.before.map((text, index) => ({ line: index + 1, text })));
            expect(sides.after).toEqual(diff.after.map((text, index) => ({ line: index + 1, text })));
        });
    }
});

test('split: deleted and added lines pair up top to bottom, the shorter side empty', () => {
    const diff = computeFileDiff('a\nold 1\nold 2\nold 3\nz\n', 'a\nnew 1\nz\n', exact);

    expect(buildDiffRows(diff, { layout: 'split', context: 3 })).toEqual([
        splitRow('1:1', { line: 1, kind: 'context' }, { line: 1, kind: 'context' }),
        splitRow('2:2', { line: 2, kind: 'deleted' }, { line: 2, kind: 'added' }),
        splitRow('3:-', { line: 3, kind: 'deleted' }, null),
        splitRow('4:-', { line: 4, kind: 'deleted' }, null),
        splitRow('5:3', { line: 5, kind: 'context' }, { line: 3, kind: 'context' }),
    ]);
});

test('split: more added than deleted leaves the left side empty', () => {
    const diff = computeFileDiff('old\n', 'new 1\nnew 2\n', exact);

    expect(buildDiffRows(diff, { layout: 'split', context: 3 })).toEqual([
        splitRow('1:1', { line: 1, kind: 'deleted' }, { line: 1, kind: 'added' }),
        splitRow('-:2', null, { line: 2, kind: 'added' }),
    ]);
});

test('unified: deleted lines come before added ones, each with its own number', () => {
    const diff = computeFileDiff('a\nold 1\nold 2\nz\n', 'a\nnew 1\nnew 2\nnew 3\nz\n', exact);

    expect(buildDiffRows(diff, { layout: 'unified', context: 3 })).toEqual([
        unifiedRow('1:1', 1, 1, ' '),
        unifiedRow('2:-', 2, null, '-'),
        unifiedRow('3:-', 3, null, '-'),
        unifiedRow('-:2', null, 2, '+'),
        unifiedRow('-:3', null, 3, '+'),
        unifiedRow('-:4', null, 4, '+'),
        unifiedRow('4:5', 4, 5, ' '),
    ]);
});

test.each(layouts)(
    '%s: gaps before the first and after the last hunk and between hunks carry the hidden lines',
    layout => {
        // Lines 10 and 25 change: context reaches 7..13 and 22..28 of 40.
        const lines = numbered(40);
        const changed = lines.map(line => (line === 'line 10' || line === 'line 25' ? `${line}!` : line));
        const rows = buildDiffRows(computeFileDiff(file(lines), file(changed), exact), { layout, context: 3 });

        expect(rows.filter(row => row.kind === 'gap')).toEqual([
            {
                kind: 'gap',
                key: 'gap:1:1',
                hidden: 6,
                range: { beforeStart: 0, beforeEnd: 6, afterStart: 0, afterEnd: 6 },
            },
            {
                kind: 'gap',
                key: 'gap:14:14',
                hidden: 8,
                range: { beforeStart: 13, beforeEnd: 21, afterStart: 13, afterEnd: 21 },
            },
            {
                kind: 'gap',
                key: 'gap:29:29',
                hidden: 12,
                range: { beforeStart: 28, beforeEnd: 40, afterStart: 28, afterEnd: 40 },
            },
        ]);
        expect(rows[0]?.kind).toBe('gap');
        expect(rows.at(-1)?.kind).toBe('gap');
    },
);

test("a gap keeps each version's own line numbers when the lines above it shifted", () => {
    const lines = numbered(20);
    const rows = buildDiffRows(computeFileDiff(file(lines), file(['new 1', 'new 2', ...lines]), exact), {
        layout: 'unified',
        context: 3,
    });

    expect(rows.filter(row => row.kind === 'gap')).toEqual([
        {
            kind: 'gap',
            key: 'gap:4:6',
            hidden: 17,
            range: { beforeStart: 3, beforeEnd: 20, afterStart: 5, afterEnd: 22 },
        },
    ]);
});

test('no gap where nothing is hidden: unchanged lines that fit the context of their two changes', () => {
    const lines = numbered(8);
    const changed = lines.map(line => (line === 'line 1' || line === 'line 8' ? `${line}!` : line));
    const rows = buildDiffRows(computeFileDiff(file(lines), file(changed), exact), { layout: 'split', context: 3 });

    expect(rows.some(row => row.kind === 'gap')).toBe(false);
    expect(rows).toHaveLength(8);
});

test('a gap as soon as one line more than the context of two changes lies between them', () => {
    const lines = numbered(9);
    const changed = lines.map(line => (line === 'line 1' || line === 'line 9' ? `${line}!` : line));
    const rows = buildDiffRows(computeFileDiff(file(lines), file(changed), exact), { layout: 'split', context: 3 });

    expect(rows.filter(row => row.kind === 'gap').map(row => row.key)).toEqual(['gap:5:5']);
});

test('context is a parameter', () => {
    const lines = numbered(21);
    const changed = lines.map(line => (line === 'line 11' ? 'changed' : line));
    const diff = computeFileDiff(file(lines), file(changed), exact);

    expect(buildDiffRows(diff, { layout: 'unified', context: 0 }).map(row => row.key)).toEqual([
        'gap:1:1',
        '11:-',
        '-:11',
        'gap:12:12',
    ]);
    expect(buildDiffRows(diff, { layout: 'unified', context: 1 }).map(row => row.key)).toEqual([
        'gap:1:1',
        '10:10',
        '11:-',
        '-:11',
        '12:12',
        'gap:13:13',
    ]);
});

test.each(layouts)('%s: a file with no change is one gap, an empty one no rows at all', layout => {
    const unchanged = computeFileDiff('a\nb\n', 'a\nb\n', exact);

    expect(buildDiffRows(unchanged, { layout, context: 3 })).toEqual([
        { kind: 'gap', key: 'gap:1:1', hidden: 2, range: { beforeStart: 0, beforeEnd: 2, afterStart: 0, afterEnd: 2 } },
    ]);
    expect(buildDiffRows(computeFileDiff(null, null, exact), { layout, context: 3 })).toEqual([]);
});

test('an added file has nothing on the left, a deleted one nothing on the right', () => {
    expect(buildDiffRows(computeFileDiff(null, 'a\n', exact), { layout: 'split', context: 3 })).toEqual([
        splitRow('-:1', null, { line: 1, kind: 'added' }),
    ]);
    expect(buildDiffRows(computeFileDiff('a\n', null, exact), { layout: 'unified', context: 3 })).toEqual([
        unifiedRow('1:-', 1, null, '-'),
    ]);
});

test('with whitespace hidden, a whitespace-only line is context beside a real change', () => {
    const diff = computeFileDiff('  one\ntwo\n', 'one\nTWO\n', { ignoreWhitespace: true });

    expect(buildDiffRows(diff, { layout: 'split', context: 3 })).toEqual([
        splitRow('1:1', { line: 1, kind: 'context' }, { line: 1, kind: 'context' }),
        splitRow('2:2', { line: 2, kind: 'deleted' }, { line: 2, kind: 'added' }),
    ]);
    expect(buildDiffRows(diff, { layout: 'unified', context: 3 })).toEqual([
        unifiedRow('1:1', 1, 1, ' '),
        unifiedRow('2:-', 2, null, '-'),
        unifiedRow('-:2', null, 2, '+'),
    ]);
});

test('a line keeps its key when the context around it changes', () => {
    const lines = numbered(30);
    const changed = lines.map(line => (line === 'line 15' ? 'changed' : line));
    const diff = computeFileDiff(file(lines), file(changed), exact);

    const narrow = buildDiffRows(diff, { layout: 'split', context: 1 }).filter(row => row.kind === 'line');
    const wide = new Set(buildDiffRows(diff, { layout: 'split', context: 5 }).map(row => row.key));

    expect(narrow.length).toBeGreaterThan(0);
    for (const row of narrow) {
        expect(wide.has(row.key)).toBe(true);
    }
});

function splitRow(key: string, left: DiffCell | null, right: DiffCell | null): DiffRow {
    return { kind: 'line', layout: 'split', key, left, right };
}

function unifiedRow(key: string, oldLine: number | null, newLine: number | null, sign: ' ' | '-' | '+'): DiffRow {
    return { kind: 'line', layout: 'unified', key, oldLine, newLine, sign };
}

interface SideLine {
    readonly line: number;
    readonly text: string | undefined;
}

/** Everything the rows say about each version, in row order; a gap stands for the lines of its ranges. */
function readSides(rows: readonly DiffRow[], diff: FileDiff) {
    const before: SideLine[] = [];
    const after: SideLine[] = [];
    for (const row of rows) {
        if (row.kind === 'gap') {
            for (let index = row.range.beforeStart; index < row.range.beforeEnd; index++) {
                before.push({ line: index + 1, text: diff.before[index] });
            }

            for (let index = row.range.afterStart; index < row.range.afterEnd; index++) {
                after.push({ line: index + 1, text: diff.after[index] });
            }

            expect(row.hidden).toBe(row.range.beforeEnd - row.range.beforeStart);
            expect(row.hidden).toBe(row.range.afterEnd - row.range.afterStart);
        } else {
            const oldLine = row.layout === 'split' ? row.left?.line : row.oldLine;
            const newLine = row.layout === 'split' ? row.right?.line : row.newLine;
            if (oldLine != null) {
                before.push({ line: oldLine, text: diff.before[oldLine - 1] });
            }

            if (newLine != null) {
                after.push({ line: newLine, text: diff.after[newLine - 1] });
            }
        }
    }

    return { before, after };
}

/** Lines that often repeat and often differ only in whitespace. */
function randomLines(random: () => number): string[] {
    const variants = ['a', ' a', 'a ', 'b', '\tb', 'c', 'c d', 'cd', ''];
    return Array.from(
        { length: Math.floor(random() * 40) },
        () => variants[Math.floor(random() * variants.length)] ?? '',
    );
}
