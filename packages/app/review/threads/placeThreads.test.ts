/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';

import { createSeededRandom } from '@/testing/createSeededRandom.js';

import { CONTEXT_LINES } from '../buildReviewRows.js';
import { addDiffLineRange, buildDiffRows } from '../diff/buildDiffRows.js';
import type { DiffLayout, DiffLineRange, DiffLineSide, DiffRow } from '../diff/buildDiffRows.js';
import { computeFileDiff } from '../diff/computeFileDiff.js';
import type { FileDiff } from '../diff/computeFileDiff.js';
import { listGoneEntries, placeThreads } from './placeThreads.js';
import type { ThreadFileView, ThreadOnHiddenLine, ThreadOnLine, ThreadPlacement } from './placeThreads.js';
import type { ReviewThread } from './ReviewThread.js';

const NO_LINES: readonly DiffLineRange[] = [];

function numbered(count: number) {
    return Array.from({ length: count }, (_, index) => `line ${index + 1}`);
}

function text(lines: readonly string[]) {
    return lines.map(line => `${line}\n`).join('');
}

function diffOf(before: readonly string[], after: readonly string[], ignoreWhitespace = false) {
    return computeFileDiff({ before: text(before), after: text(after), ignoreWhitespace });
}

function threadWith(overrides: Partial<ReviewThread> & { readonly diffHunk?: string }): ReviewThread {
    const { diffHunk = '', ...thread } = overrides;
    return {
        id: 'T',
        path: 'a.ts',
        line: null,
        startLine: null,
        originalLine: null,
        originalStartLine: null,
        diffSide: 'RIGHT',
        startDiffSide: null,
        isOutdated: false,
        isResolved: false,
        subjectType: 'LINE',
        comments: [
            {
                id: 'C',
                author: null,
                bodyHTML: '<p>Why?</p>',
                createdAt: '2026-11-02T10:00:00Z',
                url: 'https://github.com/acme/web/pull/7#c',
                diffHunk,
                outdated: thread.isOutdated ?? false,
                originalCommit: { oid: 'a91d03b00', abbreviatedOid: 'a91d03b' },
            },
        ],
        ...thread,
    };
}

function placeOne(diff: FileDiff, thread: ReviewThread, expanded = NO_LINES) {
    const [placement] = placeThreads({ kind: 'open', diff, expanded }, [thread]);
    if (!placement) {
        throw new Error('Every thread is placed');
    }

    return placement;
}

describe('a thread that is not outdated', () => {
    const before = numbered(40);
    const after = before.map((line, index) => (index === 19 ? 'changed' : line));
    const diff = diffOf(before, after);

    test('on a changed line goes after its row, whose key differs by layout', () => {
        expect(placeOne(diff, threadWith({ line: 20 }))).toMatchObject({
            kind: 'onLine',
            side: 'after',
            line: 20,
            approximate: false,
            rowKeys: { split: '20:20', unified: '-:20' },
        });
        expect(placeOne(diff, threadWith({ line: 20, diffSide: 'LEFT' }))).toMatchObject({
            kind: 'onLine',
            side: 'before',
            rowKeys: { split: '20:20', unified: '20:-' },
        });
    });

    test('with a range sits under its last line', () => {
        expect(placeOne(diff, threadWith({ line: 21, startLine: 18 }))).toMatchObject({ kind: 'onLine', line: 21 });
    });

    test('in collapsed context says how far it is from the nearest row, with the lines up to it', () => {
        // Rows show 17-23; the gaps are 1-16 and 24-40.
        expect(placeOne(diff, threadWith({ line: 30 }))).toMatchObject({
            kind: 'hiddenLine',
            distance: 7,
            direction: 'down',
            firstLine: 28,
            gap: { afterStart: 23, afterEnd: 40 },
            whitespaceChange: false,
        });
        expect(placeOne(diff, threadWith({ line: 10 }))).toMatchObject({ distance: 7, direction: 'up', firstLine: 8 });
    });

    test('on a line expanded is on a row', () => {
        expect(placeOne(diff, threadWith({ line: 30 }), [{ start: 28, end: 31 }])).toMatchObject({
            kind: 'onLine',
            rowKeys: { split: '30:30', unified: '30:30' },
        });
    });

    test('on a whitespace change hidden in a file with no other change is on its line, counted from the top', () => {
        const spaced = numbered(10);
        const tabbed = spaced.map((line, index) => (index === 3 ? `\t${line}` : line));
        expect(placeOne(diffOf(spaced, tabbed, true), threadWith({ line: 4 }))).toMatchObject({
            kind: 'hiddenLine',
            distance: 4,
            direction: 'down',
            whitespaceChange: true,
        });
    });

    test('naming a line the file does not have goes to the top, for it is still shown', () => {
        expect(placeOne(diff, threadWith({ line: 400 })).kind).toBe('fileTop');
        expect(placeOne(diff, threadWith({ line: null })).kind).toBe('fileTop');
    });
});

describe('an outdated thread', () => {
    const before = ['if (a) {', '  run();', '}', 'if (b) {', '  stop();', '}'];
    const after = ['// new', ...before];
    const diff = diffOf(before, after);
    const hunk = '@@ -1,3 +1,3 @@ fn\n if (a) {\n+  run();';

    test('whose line is found exactly once sits there, approximately, whatever line GitHub still names', () => {
        expect(placeOne(diff, threadWith({ isOutdated: true, line: 1, diffHunk: hunk }))).toMatchObject({
            kind: 'onLine',
            side: 'after',
            line: 3,
            approximate: true,
        });
    });

    test('whose line repeats goes to the top with its old code and commit', () => {
        const repeated = '@@ -1,3 +1,3 @@\n+}';
        expect(placeOne(diff, threadWith({ isOutdated: true, diffHunk: repeated }))).toMatchObject({
            kind: 'fileTop',
            diffHunk: repeated,
            commit: { abbreviatedOid: 'a91d03b' },
        });
    });

    test('whose line is gone goes to the top', () => {
        expect(placeOne(diff, threadWith({ isOutdated: true, diffHunk: '@@ -1 +1 @@\n+nowhere();' })).kind).toBe(
            'fileTop',
        );
    });

    test('on a deleted line is looked for in the file before', () => {
        const deleted = diffOf(['keep', 'old();', 'keep too'], ['keep', 'keep too']);
        expect(
            placeOne(
                deleted,
                threadWith({ isOutdated: true, diffSide: 'LEFT', diffHunk: '@@ -1,2 +1 @@\n keep\n-old();' }),
            ),
        ).toMatchObject({ kind: 'onLine', side: 'before', line: 2, approximate: true });
    });

    test('is searched by the line above a "no newline" mark, and a hunk with no code finds nothing', () => {
        const marked = '@@ -1 +1 @@\n+  run();\n\\ No newline at end of file';
        expect(placeOne(diff, threadWith({ isOutdated: true, diffHunk: marked }))).toMatchObject({ line: 3 });
        expect(placeOne(diff, threadWith({ isOutdated: true, diffHunk: '@@ -1 +1 @@' })).kind).toBe('fileTop');
    });

    test('found in collapsed context is on a hidden line, approximately', () => {
        const long = diffOf(['only here', ...numbered(30)], ['only here', ...numbered(30), 'added']);
        expect(placeOne(long, threadWith({ isOutdated: true, diffHunk: '@@ -1 +1 @@\n only here' }))).toMatchObject({
            kind: 'hiddenLine',
            approximate: true,
            line: 1,
        });
    });
});

test('a thread on the file itself goes to the top though GitHub says it is on line 1, with no code', () => {
    const diff = diffOf(['a'], ['b']);
    expect(placeOne(diff, threadWith({ subjectType: 'FILE', line: 1 }))).toMatchObject({
        kind: 'fileTop',
        diffHunk: '',
    });
});

test('with the text not here a thread is from its diffHunk alone, whatever it says', () => {
    const threads = [threadWith({ line: 3, diffHunk: '@@ x @@\n+a' }), threadWith({ subjectType: 'FILE' })];
    expect(
        placeThreads({ kind: 'collapsed' }, threads).map(placed => [
            placed.kind,
            'diffHunk' in placed && placed.diffHunk,
        ]),
    ).toEqual([
        ['inCollapsed', '@@ x @@\n+a'],
        ['inCollapsed', ''],
    ]);
});

test('a file gone keeps its entry until all of its threads are resolved', () => {
    const open = threadWith({ path: 'open.ts' });
    const resolved = threadWith({ path: 'resolved.ts', isResolved: true });
    const placements = new Map<string, readonly ThreadPlacement[]>([
        ['open.ts', placeThreads({ kind: 'gone' }, [open, { ...open, isResolved: true }])],
        ['resolved.ts', placeThreads({ kind: 'gone' }, [resolved])],
        ['listed.ts', placeThreads({ kind: 'collapsed' }, [threadWith({})])],
    ]);
    expect(listGoneEntries(placements)).toEqual(['open.ts']);
});

test('over random files and threads every thread lands exactly once, each where it says', () => {
    const random = createSeededRandom(12);
    const pick = (count: number) => Math.floor(random() * count);
    for (let round = 0; round < 300; round++) {
        const before = Array.from({ length: pick(60) }, () => (random() < 0.2 ? 'same' : `line ${pick(1000)}`));
        const after = before.flatMap(line => {
            const roll = random();
            return roll < 0.05
                ? []
                : roll < 0.1
                  ? [`new ${pick(1000)}`]
                  : roll < 0.15
                    ? [line, `new ${pick(1000)}`]
                    : [`${roll < 0.2 ? ' ' : ''}${line}`];
        });
        const diff = diffOf(before, after, random() < 0.5);
        const expanded = random() < 0.3 ? addDiffLineRange([], { start: pick(30), end: 30 + pick(30) }) : NO_LINES;
        const threads = Array.from({ length: pick(12) }, (_, index) => randomThread(index));
        const views: readonly ThreadFileView[] = [
            { kind: 'open', diff, expanded },
            { kind: 'collapsed' },
            { kind: 'gone' },
        ];
        for (const view of views) {
            const placements = placeThreads(view, threads);
            expect(placements.map(placed => placed.thread.id)).toEqual(threads.map(thread => thread.id));
        }

        const rows = new Map(
            (['split', 'unified'] as const).map(layout => [
                layout,
                buildDiffRows(diff, { layout, context: CONTEXT_LINES, expanded }),
            ]),
        );
        for (const placed of placeThreads({ kind: 'open', diff, expanded }, threads)) {
            if (placed.kind === 'onLine') {
                expectOnItsRow(placed, rows);
            } else if (placed.kind === 'hiddenLine') {
                expectInItsGap(placed, diff, rows);
            }
        }
    }

    function randomThread(index: number) {
        const diffSide = random() < 0.3 ? ('LEFT' as const) : ('RIGHT' as const);
        const isOutdated = random() < 0.4;
        const prefix = diffSide === 'LEFT' ? '-' : '+';
        return threadWith({
            id: `T${index}`,
            diffSide,
            isOutdated,
            isResolved: random() < 0.3,
            subjectType: random() < 0.1 ? 'FILE' : 'LINE',
            line: random() < 0.1 ? null : pick(70),
            diffHunk: random() < 0.1 ? '' : `@@ -1 +1 @@\n${prefix}${random() < 0.3 ? 'same' : `line ${pick(1000)}`}`,
        });
    }
});

function expectOnItsRow(placed: ThreadOnLine, rows: ReadonlyMap<DiffLayout, readonly DiffRow[]>) {
    for (const [layout, layoutRows] of rows) {
        const row = layoutRows.find(other => other.key === placed.rowKeys[layout]);
        expect(row && lineOf(row, placed.side)).toBe(placed.line);
    }
}

function expectInItsGap(placed: ThreadOnHiddenLine, diff: FileDiff, rows: ReadonlyMap<DiffLayout, readonly DiffRow[]>) {
    for (const layoutRows of rows.values()) {
        expect(layoutRows.some(row => lineOf(row, placed.side) === placed.line)).toBe(false);
        expect(layoutRows.some(row => row.kind === 'gap' && row.range.afterStart === placed.gap.afterStart)).toBe(true);
    }

    expect(placed.distance).toBeGreaterThanOrEqual(1);
    expect(placed.line - placed.firstLine).toBeLessThan(3);
    expect(placed.firstLine).toBeGreaterThan(placed.side === 'before' ? placed.gap.beforeStart : placed.gap.afterStart);
    expect(placed.line).toBeLessThanOrEqual(diff[placed.side].length);
}

function lineOf(row: DiffRow, side: DiffLineSide) {
    if (row.kind === 'gap') {
        return null;
    }

    if (row.layout === 'split') {
        return (side === 'before' ? row.left : row.right)?.line ?? null;
    }

    return side === 'before' ? row.oldLine : row.newLine;
}
