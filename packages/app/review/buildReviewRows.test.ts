import { expect, test } from 'bun:test';

import { parsePatchLayout } from '@githq/github/utils/parsePatchLayout.js';
import type { PatchLayout } from '@githq/github/utils/parsePatchLayout.js';
import { assert } from '@nzyme/utils/assert.js';

import { writeSamplePatch } from '@/testing/writeSamplePatch.js';

import {
    buildFileLineRows,
    buildPlaceholderRows,
    buildReviewRows,
    clampCommentRange,
    estimateReviewRowHeight,
    findReplacementRow,
    findReviewPositionRow,
    getCommentLine,
    getDistanceLinesToShow,
    getGapArrows,
    getGapLinesToShow,
    getGapSize,
    getGapStep,
    getReviewCommentKey,
    getReviewHeaderKey,
    getReviewPosition,
    getReviewRowPath,
    getReviewThreadKey,
} from './buildReviewRows.js';
import type { ReviewFileContent, ReviewPosition, ReviewRow } from './buildReviewRows.js';
import { computeFileDiff } from './diff/computeFileDiff.js';
import type { FileDiff } from './diff/computeFileDiff.js';
import type { ReviewFile } from './ReviewFiles.js';
import { placeThreads } from './threads/placeThreads.js';
import type { ReviewThread } from './threads/ReviewThread.js';

const A = sampleFile('src/a.ts');
const B = sampleFile('src/b.ts');
const BEFORE = lines(40);
const AFTER = BEFORE.replace('line 20\n', 'line 20 changed\nline 20b\n');
const NO_IGNORE = { ignoreWhitespace: false };
const BINARY = { kind: 'binary', before: null, after: null } as const;
const DIFF = computeFileDiff({ before: BEFORE, after: AFTER, ...NO_IGNORE });

function threadOnLine(line: number, overrides: Partial<ReviewThread> = {}): ReviewThread {
    return {
        id: `T${line}`,
        path: A.path,
        line,
        startLine: null,
        originalLine: line,
        originalStartLine: null,
        diffSide: 'RIGHT',
        startDiffSide: null,
        isOutdated: false,
        isResolved: false,
        subjectType: 'LINE',
        viewerCanReply: true,
        viewerCanResolve: true,
        viewerCanUnresolve: true,
        resolvedBy: null,
        comments: [],
        ...overrides,
    };
}

function rowsWithThreads(threads: readonly ReviewThread[], layout: 'split' | 'unified' = 'split') {
    return buildFileLineRows({
        path: A.path,
        diff: DIFF,
        layout,
        threads: placeThreads({ kind: 'open', diff: DIFF, expanded: [] }, threads),
    });
}

test("a thread on a line shown sits right after the line, on its side's half in split and across in unified", () => {
    const threads = [threadOnLine(19), threadOnLine(19, { id: 'left', diffSide: 'LEFT' })];
    const shape = (layout: 'split' | 'unified') =>
        rowsWithThreads(threads, layout).flatMap((row, index, rows) =>
            row.kind === 'thread' ? [[row.inline, rows[index - 1]?.kind]] : [],
        );

    expect(shape('split')).toEqual([
        ['right', 'line'],
        ['left', 'thread'],
    ]);
    expect(shape('unified')).toEqual([
        ['unified', 'line'],
        ['unified', 'thread'],
    ]);
});

test('a thread on a hidden line comes with its mark and up to three lines, nothing between expanded, in line order around its gap', () => {
    const rows = rowsWithThreads([threadOnLine(39, { id: 'below' }), threadOnLine(5, { id: 'above' })]);
    const around = rows.filter(row => row.kind !== 'line' || row.key.includes('threadCode'));

    expect(
        around.map(row => (row.kind === 'line' && row.line.layout === 'split' ? row.line.right?.line : row.kind)),
    ).toEqual(['gap', 'distance', 3, 4, 5, 'thread', 'distance', 37, 38, 39, 'thread', 'fileEnd']);
});

test("the file's last gap under a thread's code says what is left to the end and brings out just that; with nothing left it goes", () => {
    const rows = rowsWithThreads([threadOnLine(39)]);

    expect(rows.at(-1)).toMatchObject({ kind: 'fileEnd', hidden: 2, lines: { start: 39, end: 41 } });
    expect(rows.filter(row => row.kind === 'gap')).toHaveLength(1);
    expect(rowsWithThreads([threadOnLine(41)]).at(-1)).toMatchObject({ kind: 'thread' });
});

test('a gap counts the lines nothing shows, not those shown for its threads, overlapping ones once; all of it still takes them all', () => {
    const rows = rowsWithThreads([threadOnLine(5, { id: 'one' }), threadOnLine(6, { id: 'two' })]);
    const gap = rows.find(row => row.kind === 'gap');

    // Lines 1 to 16, of which 3 to 6 show.
    expect(gap).toMatchObject({ hidden: 12, range: { afterStart: 0, afterEnd: 16 } });
    if (gap?.kind === 'gap') {
        expect(getGapLinesToShow(gap, { direction: 'up', count: getGapSize(gap) })).toEqual({ start: 0, end: 16 });
    }
});

test('a gap all of whose lines show for threads is no row at all', () => {
    const before = lines(10);
    const after = before.replace('line 1\n', 'line one\n').replace('line 10\n', 'line ten\n');
    const diff = computeFileDiff({ before, after, ...NO_IGNORE });
    const threads = placeThreads({ kind: 'open', diff, expanded: [] }, [threadOnLine(6, { id: 'gapEnd' })]);

    const rows = buildFileLineRows({ path: A.path, diff, layout: 'split', threads });

    // Context around the two changes leaves lines 5 and 6 hidden, and the thread on 6 shows both.
    expect(rows.filter(row => row.kind === 'gap')).toEqual([]);
});

test('line endings converted from CRLF to LF are only whitespace with that hidden; the same endings on both sides are nothing', () => {
    const converted = computeFileDiff({ before: 'one\r\ntwo\r\n', after: 'one\ntwo\n', ignoreWhitespace: true });
    expect(buildFileLineRows({ path: A.path, diff: converted, layout: 'split' }).map(row => row.kind)).toEqual([
        'onlyWhitespace',
    ]);

    const same = computeFileDiff({ before: 'one\r\ntwo\r\n', after: 'one\r\ntwo\r\n', ignoreWhitespace: true });
    expect(buildFileLineRows({ path: A.path, diff: same, layout: 'split' }).map(row => row.kind)).toEqual(['gap']);
});

test('a file with nothing but hidden whitespace changes says so in place of a gap as long as the file, its thread with its line', () => {
    const before = 'one\ntwo\nthree\nfour\nfive\n';
    const after = 'one\n  two\nthree\nfour\nfive\n';
    const diff = computeFileDiff({ before, after, ignoreWhitespace: true });
    const threads = placeThreads({ kind: 'open', diff, expanded: [] }, [threadOnLine(2)]);

    const kinds = buildFileLineRows({ path: A.path, diff, layout: 'split', threads }).map(row => row.kind);

    expect(kinds).toEqual(['onlyWhitespace', 'distance', 'line', 'line', 'thread']);
    expect(buildFileLineRows({ path: A.path, diff, layout: 'split' }).map(row => row.kind)).toEqual(['onlyWhitespace']);

    const same = computeFileDiff({ before, after: before, ignoreWhitespace: true });
    expect(buildFileLineRows({ path: A.path, diff: same, layout: 'split' }).map(row => row.kind)).toEqual(['gap']);
});

test('what is left to the end held when it is expanded gives way to the nearest line, not the top of the file', () => {
    const shown = rowsWithThreads([threadOnLine(39)]);
    const mark = shown.at(-1);
    const expanded = buildFileLineRows({
        path: A.path,
        diff: DIFF,
        layout: 'split',
        expanded: [{ start: 39, end: 41 }],
        threads: placeThreads({ kind: 'open', diff: DIFF, expanded: [{ start: 39, end: 41 }] }, [threadOnLine(39)]),
    });

    const replacement = findReplacementRow({
        key: mark?.key ?? '',
        offset: 5,
        previous: withHeader(shown),
        next: withHeader(expanded),
    });

    expect(replacement?.row).toMatchObject({ kind: 'line', line: { right: { line: 40 } } });
});

test('threads on the same hidden line share their code, and all keys are unique', () => {
    const rows = rowsWithThreads([threadOnLine(39, { id: 'one' }), threadOnLine(39, { id: 'two' })]);

    expect(rows.filter(row => row.kind === 'distance')).toHaveLength(1);
    expect(rows.filter(row => row.kind === 'thread')).toHaveLength(2);
    expect(new Set(rows.map(row => row.key)).size).toBe(rows.length);
});

test('Expand to here brings out the lines between the nearest row and the thread, no further', () => {
    const rows = rowsWithThreads([threadOnLine(39), threadOnLine(5)]);
    const marks = rows.filter(row => row.kind === 'distance');

    expect(marks.map(getDistanceLinesToShow)).toEqual([
        { start: 4, end: 16 },
        { start: 24, end: 39 },
    ]);
});

test("a thread that found no line comes first, closed off from the diff; one in a collapsed file under the header, the end then the open file's", () => {
    const fileTop = placeThreads({ kind: 'open', diff: DIFF, expanded: [] }, [
        threadOnLine(1, { isOutdated: true, comments: [] }),
    ]);
    const open = buildFileLineRows({ path: A.path, diff: DIFF, layout: 'split', threads: fileTop });
    expect(open[0]).toMatchObject({ kind: 'thread', inline: null });

    const placements = placeThreads({ kind: 'collapsed', notLoaded: false }, [threadOnLine(1)]);
    const rows = buildReviewRows({
        files: [A],
        getContent: () => ({ kind: 'collapsed' }),
        getThreads: () => placements,
    });
    expect(rows.map(row => row.kind)).toEqual(['header', 'thread', 'end']);
    expect(rows[0]).toMatchObject({
        collapsed: true,
        threadsUnder: true,
        threads: { open: 1, outdated: 0, resolved: 0 },
    });
    expect(rows[2]).toMatchObject({ collapsed: false });

    const off = buildReviewRows({
        files: [A],
        getContent: () => ({ kind: 'collapsed' }),
        getThreads: () => placements,
        threadsInCollapsed: false,
    });
    expect(off.map(row => row.kind)).toEqual(['header', 'end']);
    expect(off[0]).toMatchObject({ threadsUnder: false, threads: { open: 1 } });
});

test('each file is its header, what shows under it and its end; the last is followed by room to land on', () => {
    const rows = buildReviewRows({
        files: [A, B],
        getContent: file => (file === A ? { kind: 'placeholder' } : BINARY),
    });

    expect(rows.map(row => [row.kind, getReviewRowPath(row.key)])).toEqual([
        ['header', A.path],
        ['placeholder', A.path],
        ['end', A.path],
        ['header', B.path],
        ['notice', B.path],
        ['end', B.path],
    ]);
});

test('of the files waiting for the allowance only the first says how many others wait with it', () => {
    const c = sampleFile('src/c.ts');
    const rows = buildReviewRows({
        files: [A, B, c],
        getContent: file => (file === A ? BINARY : { kind: 'paused', until: 1000 }),
    });

    expect(rows.flatMap(row => (row.kind === 'paused' ? [[row.file.path, row.others]] : []))).toEqual([
        [B.path, 1],
        [c.path, null],
    ]);
});

test("a file with no lines to show says it is empty; a failed one carries GitHub's answer", () => {
    const error = new Error('GitHub answered 502');
    const rows = buildReviewRows({
        files: [A, B],
        getContent: file => (file === A ? { kind: 'lines', rows: [] } : { kind: 'failed', error }),
    });

    expect(rows[1]).toMatchObject({ kind: 'notice', notice: 'empty' });
    expect(rows[4]).toMatchObject({ kind: 'failed', error });
});

test('the same diff line in two files or two layouts has different keys, a header the same in all', () => {
    const inA = buildFileLineRows({ path: A.path, diff: DIFF, layout: 'split' });
    const inB = buildFileLineRows({ path: B.path, diff: DIFF, layout: 'split' });
    const unified = buildFileLineRows({ path: A.path, diff: DIFF, layout: 'unified' });

    const keys = [...inA, ...inB, ...unified].map(row => row.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(getReviewHeaderKey(A.path)).toBe(buildAll([A], 'split')[0]?.key ?? '');
    expect(buildAll([A], 'unified')[0]?.key).toBe(buildAll([A], 'split')[0]?.key);
});

test('a placeholder is about as tall as the file, within limits', () => {
    const rows = buildReviewRows({
        files: [sampleFile('tiny', 1, 0), sampleFile('mid', 30, 10), sampleFile('huge', 90_000, 10)],
        getContent: () => ({ kind: 'placeholder' }),
    });

    const heights = rows.filter(row => row.kind === 'placeholder').map(estimateReviewRowHeight);
    expect(heights).toEqual([60, 800, 40_000]);
});

/**
 * Each a file before and after: hunks merged across 6 unchanged lines and kept apart across 7, a change at the first line
 * and at the last, a single line before the first hunk, runs of deleted and added lines of different lengths, an added and a deleted file.
 */
const PATCH_SAMPLES: readonly (readonly [string, string | null, string | null])[] = [
    ['two hunks and one merged', lines(60), edit(lines(60), { 10: ['ten'], 17: ['seventeen', 'more'], 40: [] })],
    ['kept apart by one line', lines(30), edit(lines(30), { 5: ['five'], 13: ['thirteen'] })],
    ['7 lines apart, one line above', lines(20), edit(lines(20), { 5: ['five'], 13: ['thirteen'] })],
    ['a change at line 2', lines(20), edit(lines(20), { 2: ['two'] })],
    ['a hunk from line 2', lines(20), edit(lines(20), { 5: ['five'] })],
    ['the first and the last line', lines(20), edit(lines(20), { 1: ['one', 'one b', 'one c'], 20: ['twenty'] })],
    ['near the end', lines(20), edit(lines(20), { 18: [] })],
    ['runs of different lengths', lines(40), edit(lines(40), { 10: [], 11: [], 12: ['x'], 25: ['a', 'b', 'c', 'd'] })],
    ['added', null, lines(12)],
    ['deleted', lines(12), null],
];

test.each(PATCH_SAMPLES)(
    'a placeholder from the patch draws the rows its diff will, numbered the same, as tall: %s',
    (_, before, after) => {
        const diff = computeFileDiff({ before, after, ...NO_IGNORE });
        const file: ReviewFile = { ...A, patch: { layout: toPatchLayout(diff), verdict: null } };
        for (const layout of ['split', 'unified'] as const) {
            const placeholder = buildPlaceholderRows({ file, layout, hideWhitespace: false });
            const real = buildFileLineRows({ path: A.path, diff, layout });

            expect(placeholder.map(describeRow)).toEqual(real.map(describeRow));
            expect(sumHeights(placeholder)).toBe(sumHeights(real));
        }
    },
);

test('a placeholder from the patch tints its changed lines, but not with whitespace hidden', () => {
    const diff = computeFileDiff({ before: lines(20), after: edit(lines(20), { 10: ['ten'] }), ...NO_IGNORE });
    const file: ReviewFile = { ...A, patch: { layout: toPatchLayout(diff), verdict: null } };

    const tints = (hideWhitespace: boolean) =>
        buildPlaceholderRows({ file, layout: 'unified', hideWhitespace }).flatMap(row =>
            row.part.kind === 'line' && row.part.line.kind === 'unified' ? [row.part.line.tint] : [],
        );

    expect(tints(false)).toEqual([null, null, null, 'deleted', 'added', null, null, null]);
    expect(tints(true).every(tint => tint === null)).toBe(true);
});

test('a file with no patch, or no hunks in it, keeps the guess from its line counts', () => {
    const guessed = (patch: ReviewFile['patch']) =>
        buildPlaceholderRows({ file: { ...A, patch }, layout: 'split', hideWhitespace: false }).map(row => row.part);

    expect(guessed(undefined)).toEqual([{ kind: 'guess' }]);
    expect(guessed({ layout: null, verdict: null })).toEqual([{ kind: 'guess' }]);
    expect(guessed({ layout: { hunks: [] }, verdict: null })).toEqual([{ kind: 'guess' }]);
});

test('a line held through a layout switch stays on the same line of the newer version', () => {
    const split = buildAll([A], 'split');
    const unified = buildAll([A], 'unified');
    const held = lineWithAfter(split, 19);

    const replacement = findReplacementRow({ key: held.key, offset: -12, previous: split, next: unified });

    expect(replacement).toMatchObject({ row: { kind: 'line', line: { layout: 'unified', newLine: 19 } }, offset: -12 });
});

test('a deleted line held has no newer line: it goes by the older one', () => {
    const unified = buildAll([A], 'unified');
    const split = buildAll([A], 'split');
    const deleted = unified.find(row => row.kind === 'line' && row.line.layout === 'unified' && row.line.sign === '-');
    if (!deleted) {
        throw new Error('The sample has a deleted line');
    }

    const replacement = findReplacementRow({ key: deleted.key, offset: 0, previous: unified, next: split });

    expect(replacement?.row).toMatchObject({ kind: 'line', line: { left: { line: 20, kind: 'deleted' } } });
});

test('a line that whitespace hides gives way to the gap that now covers it', () => {
    const before = 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nk\nl\nm\nn\no\np\n';
    const after = before.replace('b\n', '  b\n').replace('o\n', 'oo\n');
    const shown = rowsOf(computeFileDiff({ before, after, ignoreWhitespace: false }));
    const hidden = rowsOf(computeFileDiff({ before, after, ignoreWhitespace: true }));
    const held = shown.find(row => row.kind === 'line' && row.line.layout === 'split' && row.line.right?.line === 2);
    if (!held) {
        throw new Error('The sample shows line 2');
    }

    expect(findReplacementRow({ key: held.key, offset: 0, previous: shown, next: hidden })?.row).toMatchObject({
        kind: 'gap',
        firstLine: 1,
        hidden: 11,
    });
});

test('a deleted line that whitespace hides, far past the first change, lands on the gap holding its older line (D7)', () => {
    const before = lines(300);
    let after = before;
    for (const line of [11, 61, 111, 161]) {
        after = after.replace(`line ${line}\n`, `line ${line} changed\n`);
    }

    after = after.replace('line 281\n', '  line 281\n');
    const shown = unifiedRowsOf(computeFileDiff({ before, after, ignoreWhitespace: false }));
    const hidden = unifiedRowsOf(computeFileDiff({ before, after, ignoreWhitespace: true }));
    const held = shown.find(
        row =>
            row.kind === 'line' && row.line.layout === 'unified' && row.line.oldLine === 281 && row.line.sign === '-',
    );
    if (!held) {
        throw new Error('The sample deletes line 281');
    }

    const replacement = findReplacementRow({ key: held.key, offset: 0, previous: shown, next: hidden });

    expect(replacement?.row).toMatchObject({ kind: 'gap', firstLine: 165, hidden: 136 });
});

test('a line past what a file now holds lands on the nearest row above it, not at the top (D7)', () => {
    const before = lines(40);
    const shorter = lines(25).replace('line 20\n', 'line 20 changed\n');
    const shown = rowsOf(
        computeFileDiff({ before, after: before.replace('line 39\n', 'line 39 changed\n'), ...NO_IGNORE }),
    );
    const next = rowsOf(computeFileDiff({ before: lines(25), after: shorter, ...NO_IGNORE }));
    const held = lineWithAfter(shown, 39);

    expect(findReplacementRow({ key: held.key, offset: 0, previous: shown, next })?.row).toMatchObject({
        kind: 'gap',
        firstLine: 24,
        hidden: 2,
    });
});

test('guessed bars held give way to the top of their file, whatever it arrived as: how far into them the reader was means nothing there', () => {
    const waiting = buildReviewRows({ files: [A, B], getContent: () => ({ kind: 'placeholder' }) });
    const held = waiting.find(row => row.kind === 'placeholder');
    if (!held) {
        throw new Error('The sample has a placeholder');
    }

    const arrivals: ReviewFileContent[] = [
        { kind: 'lines', rows: buildFileLineRows({ path: A.path, diff: DIFF, layout: 'split' }) },
        BINARY,
        { kind: 'failed', error: new Error('Refused') },
    ];
    for (const content of arrivals) {
        const next = buildReviewRows({ files: [A, B], getContent: () => content });
        const replacement = findReplacementRow({ key: held.key, offset: -3000, previous: waiting, next });

        expect(replacement?.row.key).toBe(getReviewHeaderKey(A.path));
        expect(replacement?.offset).toBe(0);
    }
});

test('nothing replaces a row still there, or one of a file when no file is left', () => {
    const split = buildAll([A, B], 'split');
    const header = split[0];
    const line = lineWithAfter(split, 19);
    if (!header) {
        throw new Error('The sample has a header');
    }

    expect(findReplacementRow({ key: header.key, offset: 0, previous: split, next: split })).toBeNull();
    expect(findReplacementRow({ key: line.key, offset: 0, previous: split, next: [] })).toBeNull();
});

test('a file gone from under a reader deep in it (D9): the next file starts at the top of the screen, whatever the reader was at', () => {
    const shown = buildAll([A, B], 'split');
    const line = lineWithAfter(shown, 19);

    expect(findReplacementRow({ key: line.key, offset: -300, previous: shown, next: buildAll([B], 'split') })).toEqual({
        row: expect.objectContaining({ key: getReviewHeaderKey(B.path) }),
        offset: 0,
    });
});

test('a file gone whose start was lower down (D9): the next one arrives where it started, not above', () => {
    const shown = buildAll([A, B], 'split');
    const next = buildAll([B], 'split');
    const key = getReviewHeaderKey(A.path);

    expect(findReplacementRow({ key, offset: 120, previous: shown, next })).toMatchObject({
        row: { key: getReviewHeaderKey(B.path) },
        offset: 120,
    });
    expect(findReplacementRow({ key, offset: -40, previous: shown, next })).toMatchObject({
        row: { key: getReviewHeaderKey(B.path) },
        offset: 0,
    });
});

test('the last file gone gives way to the one before it, and several gone at once to the next still there', () => {
    const C = sampleFile('src/c.ts');
    const three = buildAll([A, B, C], 'split');

    expect(
        findReplacementRow({
            key: getReviewHeaderKey(C.path),
            offset: 0,
            previous: three,
            next: buildAll([A, B], 'split'),
        }),
    ).toMatchObject({ row: { key: getReviewHeaderKey(B.path) }, offset: 0 });
    expect(
        findReplacementRow({
            key: getReviewHeaderKey(A.path),
            offset: 0,
            previous: three,
            next: buildAll([C], 'split'),
        }),
    ).toMatchObject({ row: { key: getReviewHeaderKey(C.path) }, offset: 0 });
});

test('a file collapsed under a reader deep in it shows its header at the top; one opened from its end does too', () => {
    const open = buildAll([A], 'split');
    const line = lineWithAfter(open, 19);
    const collapsed = buildReviewRows({
        files: [A],
        getContent: (): ReviewFileContent => ({ kind: 'collapsed' }),
    });
    const header = { row: { key: getReviewHeaderKey(A.path) }, offset: 0 };

    expect(findReplacementRow({ key: line.key, offset: -200, previous: open, next: collapsed })).toMatchObject(header);

    const end = collapsed.find(row => row.kind === 'end');
    expect(findReplacementRow({ key: end?.key ?? '', offset: -10, previous: collapsed, next: open })).toMatchObject(
        header,
    );
});

test('a position kept on a line lands on that line in the other layout, at the same distance from the top', () => {
    const split = lineWithAfter(rowsOf(DIFF), 21);
    const position = getReviewPosition(split, -7);

    const found = findReviewPositionRow({ position, rows: unifiedRowsOf(DIFF), order: [A.path] });

    expect(found?.offset).toBe(-7);
    expect(found?.landing).toBe('arrived');
    const { row } = found ?? {};
    expect(row?.kind === 'line' && row.line.layout === 'unified' && row.line.newLine).toBe(21);
});

test('a line deleted is kept by its older side, in either layout', () => {
    const rows = unifiedRowsOf(DIFF);
    const deleted = rows.find(row => row.kind === 'line' && row.line.layout === 'unified' && row.line.newLine === null);
    expect(deleted).toBeDefined();
    const position = getReviewPosition(deleted!, 0);
    expect(position.place).toEqual({ kind: 'line', path: A.path, side: 'before', line: 20 });

    const { row } = findReviewPositionRow({ position, rows: rowsOf(DIFF), order: [A.path] }) ?? {};

    expect(row?.kind === 'line' && row.line.layout === 'split' && row.line.left?.line).toBe(20);
});

test('a line hidden now lands on the nearest shown above it, a gap covering it counting', () => {
    const position: ReviewPosition = { place: { kind: 'line', path: A.path, side: 'after', line: 25 }, offset: 4 };
    const narrow = buildReviewRows({
        files: [A],
        getContent: () => ({
            kind: 'lines',
            // Line 25 itself is left out, as whitespace hidden leaves out a line.
            rows: buildFileLineRows({ path: A.path, diff: DIFF, layout: 'split' }).filter(
                row => !(row.kind === 'line' && row.line.layout === 'split' && row.line.right?.line === 23),
            ),
        }),
    });

    const inGap = findReviewPositionRow({ position, rows: rowsOf(DIFF), order: [A.path] });
    expect(inGap?.row.kind).toBe('gap');
    expect(inGap?.offset).toBe(4);

    const above = findReviewPositionRow({
        position: { ...position, place: { ...position.place, kind: 'line', path: A.path, side: 'after', line: 23 } },
        rows: narrow,
        order: [A.path],
    });
    expect(above?.row).toBe(lineWithAfter(narrow, 22));
});

test("a position on a gap lands on the gap, though a thread's code from further down shows before it", () => {
    const diff = computeFileDiff({
        before: BEFORE,
        after: BEFORE.replace('line 5\n', 'line 5 changed\n').replace('line 35\n', 'line 35 changed\n'),
        ...NO_IGNORE,
    });
    const threads = placeThreads({ kind: 'open', diff, expanded: [] }, [threadOnLine(15)]);
    const rows = withHeader(buildFileLineRows({ path: A.path, diff, layout: 'split', threads }));
    const gap = rows.find(row => row.kind === 'gap' && rows.indexOf(row) > rows.indexOf(lineWithAfter(rows, 15)));
    if (gap?.kind !== 'gap') {
        throw new Error("The thread's code shows before the gap");
    }

    expect(gap.firstLine).toBeLessThan(15);
    const at = (line: number) =>
        findReviewPositionRow({
            position: { place: { kind: 'line', path: A.path, side: 'after', line }, offset: 0 },
            rows,
            order: [A.path],
        })?.row;

    expect(at(gap.firstLine)).toBe(gap);
    expect(at(15)).toBe(lineWithAfter(rows, 15));
    // Past the thread's code and hidden, nothing shown is nearer than that code.
    expect(at(20)).toBe(lineWithAfter(rows, 15));
});

test('a file not arrived holds its header at the top; a thread is found by its key meanwhile, wherever it shows', () => {
    const rows = buildReviewRows({
        files: [A],
        getContent: () => ({ kind: 'placeholder' }),
        getThreads: () => placeThreads({ kind: 'collapsed', notLoaded: false }, [threadOnLine(20)]),
    });
    const onLine: ReviewPosition = { place: { kind: 'line', path: A.path, side: 'after', line: 21 }, offset: 120 };

    expect(findReviewPositionRow({ position: onLine, rows, order: [A.path] })).toMatchObject({
        row: { key: getReviewHeaderKey(A.path) },
        offset: 0,
        landing: 'fileWaiting',
    });

    const key = getReviewThreadKey(A.path, threadOnLine(20).id);
    expect(
        findReviewPositionRow({ position: { place: { kind: 'row', key }, offset: 90 }, rows, order: [A.path] }),
    ).toMatchObject({ row: { key }, offset: 90, landing: 'arrived' });
});

test('a position inside guessed bars is kept as its file, for how far says nothing of what comes', () => {
    const rows = buildReviewRows({ files: [A], getContent: () => ({ kind: 'placeholder' }) });
    const placeholder = rows.find(row => row.kind === 'placeholder');

    expect(getReviewPosition(placeholder!, -300)).toEqual({
        place: { kind: 'row', key: getReviewHeaderKey(A.path) },
        offset: 0,
    });
});

test("a placeholder's line holds the position as the line it stands for, when the file arrives and across layouts", () => {
    const file: ReviewFile = { ...A, patch: { layout: toPatchLayout(DIFF), verdict: null } };
    const waiting = (layout: 'split' | 'unified') =>
        buildReviewRows({
            files: [file, B],
            getContent: () => ({
                kind: 'placeholder',
                rows: buildPlaceholderRows({ file, layout, hideWhitespace: false }),
            }),
        });
    const split = waiting('split');
    const held = split.find(
        row =>
            row.kind === 'placeholder' &&
            row.part.kind === 'line' &&
            row.part.line.kind === 'split' &&
            row.part.line.right?.line === 19,
    );
    assert(held);

    expect(getReviewPosition(held, -40)).toEqual({
        place: { kind: 'line', path: A.path, side: 'after', line: 19 },
        offset: -40,
    });

    const arrived = buildAll([A, B], 'split');
    expect(findReplacementRow({ key: held.key, offset: -40, previous: split, next: arrived })).toEqual({
        row: lineWithAfter(arrived, 19),
        offset: -40,
    });

    const unified = waiting('unified');
    const switched = findReplacementRow({ key: held.key, offset: -40, previous: split, next: unified });
    expect(switched?.offset).toBe(-40);
    expect(
        switched?.row.kind === 'placeholder' && switched.row.part.kind === 'line' && switched.row.part.line,
    ).toMatchObject({
        kind: 'unified',
        newLine: 19,
    });

    const position = getReviewPosition(held, -40);
    expect(findReviewPositionRow({ position, rows: unified, order: [A.path, B.path] })).toMatchObject({
        row: { key: switched?.row.key },
        offset: -40,
        landing: 'fileWaiting',
    });
});

test("a file not among the rows gives way to the next one still there; a thread gone to its file's top", () => {
    const rows = buildAll([B], 'split');
    const position: ReviewPosition = { place: { kind: 'line', path: A.path, side: 'after', line: 21 }, offset: 50 };

    expect(findReviewPositionRow({ position, rows, order: [A.path, B.path] })).toMatchObject({
        row: { key: getReviewHeaderKey(B.path) },
        offset: 0,
        landing: 'fileMissing',
    });
    expect(
        findReviewPositionRow({
            position: { place: { kind: 'row', key: getReviewThreadKey(B.path, 'gone') }, offset: 50 },
            rows,
            order: [A.path, B.path],
        }),
    ).toMatchObject({ row: { key: getReviewHeaderKey(B.path) }, offset: 0, landing: 'arrived' });
});

function buildAll(files: readonly ReviewFile[], layout: 'split' | 'unified'): ReviewRow[] {
    return buildReviewRows({
        files,
        getContent: (file): ReviewFileContent => ({
            kind: 'lines',
            rows: buildFileLineRows({ path: file.path, diff: DIFF, layout }),
        }),
    });
}

function withHeader(rows: readonly ReviewRow[]): ReviewRow[] {
    return buildReviewRows({ files: [A], getContent: () => ({ kind: 'lines', rows }) });
}

function rowsOf(diff: typeof DIFF): ReviewRow[] {
    return buildReviewRows({
        files: [A],
        getContent: () => ({ kind: 'lines', rows: buildFileLineRows({ path: A.path, diff, layout: 'split' }) }),
    });
}

function unifiedRowsOf(diff: typeof DIFF): ReviewRow[] {
    return buildReviewRows({
        files: [A],
        getContent: () => ({ kind: 'lines', rows: buildFileLineRows({ path: A.path, diff, layout: 'unified' }) }),
    });
}

function lineWithAfter(rows: readonly ReviewRow[], line: number): ReviewRow {
    const found = rows.find(row => row.kind === 'line' && row.line.layout === 'split' && row.line.right?.line === line);
    if (!found) {
        throw new Error(`No row of line ${line}`);
    }

    return found;
}

/** The lines replaced, by their 1-based number in the older version; an empty array deletes the line. */
function edit(text: string, replaced: Readonly<Record<number, readonly string[]>>) {
    return text
        .split('\n')
        .slice(0, -1)
        .flatMap((line, index) => replaced[index + 1] ?? [line])
        .map(line => `${line}\n`)
        .join('');
}

/** The layout of the patch git would write of our own diff: GitHub's own may pair or place a change differently (D6), and D7 absorbs it. */
function toPatchLayout(diff: FileDiff): PatchLayout {
    const layout = parsePatchLayout(writeSamplePatch(diff).patch ?? '');
    assert(layout);
    return layout;
}

/** A row by what it shows: a line's numbers on each side, or a gap's count, which the patch can't say at the file's end. */
function describeRow(row: ReviewRow): string {
    switch (row.kind) {
        case 'line':
            return row.line.layout === 'split'
                ? `${row.line.left?.line ?? '-'}|${row.line.right?.line ?? '-'}`
                : `${row.line.oldLine ?? '-'}|${row.line.newLine ?? '-'}`;
        case 'gap':
            return row.atFileEnd ? 'gap:end' : `gap:${row.hidden}`;
        case 'placeholder': {
            const { part } = row;
            if (part.kind === 'gap') {
                return part.gap.way === 'down' ? 'gap:end' : `gap:${part.gap.hidden}`;
            }

            if (part.kind !== 'line') {
                return part.kind;
            }

            return part.line.kind === 'split'
                ? `${part.line.left?.line ?? '-'}|${part.line.right?.line ?? '-'}`
                : `${part.line.oldLine ?? '-'}|${part.line.newLine ?? '-'}`;
        }
        default:
            return row.kind;
    }
}

function sumHeights(rows: readonly ReviewRow[]) {
    let total = 0;
    for (const row of rows) {
        total += estimateReviewRowHeight(row);
    }

    return total;
}

function lines(count: number) {
    return Array.from({ length: count }, (_, index) => `line ${index + 1}\n`).join('');
}

function sampleFile(path: string, additions = 2, deletions = 1): ReviewFile {
    return { path, previousPath: null, changeType: 'MODIFIED', additions, deletions, viewed: 'UNVIEWED' };
}

test('expanded lines keep the keys of the lines shown, and the rest of the gap keeps its own', () => {
    const before = buildFileLineRows({ path: A.path, diff: DIFF, layout: 'split' });
    const gap = before.find(row => row.kind === 'gap');
    if (gap?.kind !== 'gap') {
        throw new Error('No gap');
    }

    const shown = getGapLinesToShow(gap, { direction: 'up', count: 5 });
    expect(shown).toEqual({ start: gap.range.afterEnd - 5, end: gap.range.afterEnd });

    const after = buildFileLineRows({ path: A.path, diff: DIFF, layout: 'split', expanded: [shown] });
    const keys = new Set(after.map(row => row.key));
    expect(before.every(row => keys.has(row.key))).toBe(true);
    expect(after.length).toBe(before.length + 5);
    expect(after.find(row => row.key === gap.key)).toMatchObject({ kind: 'gap', hidden: gap.hidden - 5 });
});

test('a push having reset what was expanded, only the first gap says so', () => {
    const rows = buildFileLineRows({ path: A.path, diff: DIFF, layout: 'split', expansionReset: true });

    expect(rows.filter(row => row.kind === 'gap').map(gap => gap.expansionReset)).toEqual([
        true,
        ...rows
            .filter(row => row.kind === 'gap')
            .slice(1)
            .map(() => false),
    ]);
    expect(rows.filter(row => row.kind === 'gap').length).toBeGreaterThan(1);
});

test("a push's reset is said by the first gap still hiding lines, past one whose lines all show for a thread; by the first alone when none does (CR62)", () => {
    const build = (text: string) => {
        const after = text.replace('line 1\n', 'line one\n').replace('line 10\n', 'line ten\n');
        const diff = computeFileDiff({ before: text, after, ...NO_IGNORE });
        const threads = placeThreads({ kind: 'open', diff, expanded: [] }, [threadOnLine(6, { id: 'gapEnd' })]);
        return buildFileLineRows({ path: A.path, diff, layout: 'split', expansionReset: true, threads }).flatMap(row =>
            row.kind === 'gap' ? [[row.firstLine, row.hidden, row.expansionReset]] : [],
        );
    };

    // Lines 5 and 6 all show for the thread on 6; 14 to 30 stay hidden.
    expect(build(lines(30))).toEqual([[14, 17, true]]);
    expect(build(lines(10))).toEqual([[5, 0, true]]);
});

test('each kind of gap has its arrows: up at the top of a file, down at its end, both between hunks, one for a short gap', () => {
    const gaps = Object.values(getGaps());

    expect(gaps.map(gap => [gap.hidden, getGapArrows(gap)])).toEqual([
        [26, 'up'],
        [33, 'both'],
        [8, 'all'],
        [32, 'down'],
    ]);
    expect(gaps.map(estimateReviewRowHeight)).toEqual([26, 26, 26, 25]);
});

test('an arrow shows 20 lines from its side of the gap: down below the hunk above, up above the hunk below', () => {
    const { top, between, end } = getGaps();

    expect(getGapLinesToShow(between, { direction: 'down', count: 20 })).toEqual({ start: 33, end: 53 });
    expect(getGapLinesToShow(between, { direction: 'up', count: 20 })).toEqual({ start: 46, end: 66 });
    expect(getGapLinesToShow(top, { direction: 'up', count: 20 })).toEqual({ start: 6, end: 26 });
    expect(getGapLinesToShow(end, { direction: 'down', count: 20 })).toEqual({ start: 88, end: 108 });
    expect(getGapLinesToShow(end, { direction: 'down', count: 1000 })).toEqual({ start: 88, end: 120 });
});

test("a click on a gap and E go 20 toward the hunk named, a file's top or end its one way, and a short gap opens whole", () => {
    const { top, between, short, end } = getGaps();

    expect(getGapStep(between, 'down')).toEqual({ direction: 'down', count: 20 });
    expect(getGapStep(between, 'up')).toEqual({ direction: 'up', count: 20 });
    expect(getGapStep(top, 'down')).toEqual({ direction: 'up', count: 20 });
    expect(getGapStep(end, 'up')).toEqual({ direction: 'down', count: 20 });
    expect(getGapStep(short, 'up')).toEqual({ direction: 'up', count: 8 });
    expect(getGapStep(short, 'down')).toEqual({ direction: 'down', count: 8 });
    expect(getGapLinesToShow(short, getGapStep(short, 'down'))).toEqual({ start: 73, end: 81 });
});

/** A file of 120 lines changed at 30, 70 and 85: a gap at its top, two between hunks, a long and a short one, and one at its end. */
function getGaps() {
    const before = lines(120);
    const after = ['30', '70', '85'].reduce(
        (text, line) => text.replace(`line ${line}\n`, `line ${line} changed\n`),
        before,
    );
    const diff = computeFileDiff({ before, after, ...NO_IGNORE });
    const gaps = buildFileLineRows({ path: A.path, diff, layout: 'split' }).filter(row => row.kind === 'gap');
    const [top, between, short, end] = gaps;
    if (!top || !between || !short || !end || gaps.length !== 4) {
        throw new Error('Not the four gaps');
    }

    return { top, between, short, end };
}

test('a file filtered away gives way to the next left in the whole order, one the rows held before not shown (D7)', () => {
    const c = sampleFile('src/c.ts');
    const previous = buildReviewRows({ files: [A], getContent: () => BINARY });
    const next = buildReviewRows({ files: [c], getContent: () => BINARY });

    const replacement = findReplacementRow({
        key: getReviewHeaderKey(A.path),
        offset: 0,
        previous,
        next,
        order: [A.path, B.path, c.path],
    });

    expect(replacement?.row.key).toBe(getReviewHeaderKey(c.path));
});

test('a place inside a resolved thread lands at its top: it comes back as one line, and the distance was measured on an open one', () => {
    const rows = rowsWithThreads([threadOnLine(41)]).map(row =>
        row.kind === 'thread'
            ? { ...row, placement: { ...row.placement, thread: { ...row.placement.thread, isResolved: true } } }
            : row,
    );
    const thread = rows.find(row => row.kind === 'thread');
    const found = findReviewPositionRow({
        position: { place: { kind: 'row', key: thread?.key ?? '' }, offset: -300 },
        rows,
        order: [A.path],
    });

    expect(found?.row.kind).toBe('thread');
    expect(found?.offset).toBe(0);
});

function commentOn(line: number, side: 'before' | 'after' = 'after', startLine: number | null = null) {
    return { id: `box${line}`, path: A.path, side, line, startLine, threadId: null };
}

function commentRow(rows: readonly ReviewRow[], id: string) {
    const index = rows.findIndex(row => row.key === getReviewCommentKey(A.path, id));
    return { index, row: rows[index], above: rows[index - 1] };
}

test('a comment box sits under its line and what is under that, on its own half in split, under one key in both layouts', () => {
    const threads = placeThreads({ kind: 'open', diff: DIFF, expanded: [] }, [threadOnLine(19)]);
    const split = buildFileLineRows({
        path: A.path,
        diff: DIFF,
        layout: 'split',
        threads,
        comments: [commentOn(19), commentOn(19, 'before')],
    });
    const unified = buildFileLineRows({ path: A.path, diff: DIFF, layout: 'unified', comments: [commentOn(19)] });

    const onRight = commentRow(split, 'box19');
    expect(onRight.row).toMatchObject({ kind: 'comment', inline: 'right' });
    expect(onRight.above?.kind).toBe('thread');
    expect(commentRow(unified, 'box19').row).toMatchObject({ kind: 'comment', inline: 'unified' });
    expect(commentRow(unified, 'box19').above).toMatchObject({ kind: 'line', line: { newLine: 19 } });
});

test('a reply sits right under its thread, on its half; with its thread not shown, first, for its text to stay in sight', () => {
    const thread = threadOnLine(19);
    const threads = placeThreads({ kind: 'open', diff: DIFF, expanded: [] }, [thread]);
    const reply = { ...commentOn(19), id: 'reply', threadId: thread.id };

    const rows = buildFileLineRows({ path: A.path, diff: DIFF, layout: 'split', threads, comments: [reply] });
    expect(commentRow(rows, 'reply').row).toMatchObject({ inline: 'right' });
    expect(commentRow(rows, 'reply').above?.kind).toBe('thread');

    const alone = buildFileLineRows({ path: A.path, diff: DIFF, layout: 'split', comments: [reply] });
    expect(alone[0]).toMatchObject({ kind: 'comment', inline: null });
});

test("a comment box whose line isn't shown stays in sight at the top of its file, and under a collapsed file's header", () => {
    const rows = buildFileLineRows({ path: A.path, diff: DIFF, layout: 'split', comments: [commentOn(2)] });
    expect(rows[0]).toMatchObject({ kind: 'comment', inline: null });

    const collapsed = buildReviewRows({
        files: [A],
        getContent: () => ({ kind: 'collapsed' }),
        threadsInCollapsed: false,
        getComments: () => [commentOn(2)],
    });
    expect(collapsed.map(row => row.kind)).toEqual(['header', 'comment', 'end']);
    expect(collapsed[0]).toMatchObject({ threadsUnder: true });
});

test('a box gone from the rows it was held at gives way to its line, not to the top of its file', () => {
    const withBox = buildFileLineRows({ path: A.path, diff: DIFF, layout: 'split', comments: [commentOn(21)] });
    const without = buildFileLineRows({ path: A.path, diff: DIFF, layout: 'split' });
    const replacement = findReplacementRow({
        key: getReviewCommentKey(A.path, 'box21'),
        offset: 40,
        previous: buildReviewRows({ files: [A], getContent: () => ({ kind: 'lines', rows: withBox }) }),
        next: buildReviewRows({ files: [A], getContent: () => ({ kind: 'lines', rows: without }) }),
    });

    expect(replacement?.offset).toBe(40);
    expect(replacement?.row).toMatchObject({ kind: 'line', line: { right: { line: 21 } } });
});

test("C takes a code row's line on its newer side unless it has none, and nothing from a row that is not code", () => {
    const rows = buildReviewRows({
        files: [A],
        getContent: () => ({ kind: 'lines', rows: buildFileLineRows({ path: A.path, diff: DIFF, layout: 'unified' }) }),
    });
    const older = rows.map(getCommentLine).filter(line => line?.side === 'before');

    expect(getCommentLine(rows[0]!)).toBeNull();
    expect(older).toEqual([expect.objectContaining({ path: A.path, line: 20 })]);
});

test('a range reaches as far as the lines go on together, and stops at what hides lines', () => {
    const rows = buildReviewRows({
        files: [A],
        getContent: () => ({ kind: 'lines', rows: buildFileLineRows({ path: A.path, diff: DIFF, layout: 'split' }) }),
    });
    const params = { rows, path: A.path, side: 'after' as const, line: 19 };

    expect(clampCommentRange({ ...params, to: 22 })).toBe(22);
    expect(clampCommentRange({ ...params, to: 18 })).toBe(18);
    // Three lines of context either side of the change: past them the gap.
    expect(clampCommentRange({ ...params, to: 40 })).toBe(24);
    expect(clampCommentRange({ ...params, to: 2 })).toBe(17);
});
