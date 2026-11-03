import { expect, test } from 'bun:test';

import {
    buildFileLineRows,
    buildReviewRows,
    estimateReviewRowHeight,
    findReplacementRow,
    getDistanceLinesToShow,
    getGapLinesToShow,
    getReviewHeaderKey,
    getReviewRowPath,
} from './buildReviewRows.js';
import type { ReviewFileContent, ReviewRow } from './buildReviewRows.js';
import { computeFileDiff } from './diff/computeFileDiff.js';
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

test('a gap counts the lines nothing shows, not those shown for its threads, overlapping ones once; Show all still takes them all', () => {
    const rows = rowsWithThreads([threadOnLine(5, { id: 'one' }), threadOnLine(6, { id: 'two' })]);
    const gap = rows.find(row => row.kind === 'gap');

    // Lines 1 to 16, of which 3 to 6 show.
    expect(gap).toMatchObject({ hidden: 12, range: { afterStart: 0, afterEnd: 16 } });
    if (gap?.kind === 'gap') {
        expect(getGapLinesToShow(gap, gap.range.afterEnd - gap.range.afterStart)).toEqual({ start: 0, end: 16 });
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
    expect(rows.map(row => row.kind)).toEqual(['header', 'thread', 'end', 'tail']);
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
    expect(off.map(row => row.kind)).toEqual(['header', 'end', 'tail']);
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
        ['tail', B.path],
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

test('a placeholder held gives way to the top of its file, whatever it arrived as: how far into it the reader was means nothing there', () => {
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

test('the room under what was the last file gives way to what now follows that file, as more of the list arrives', () => {
    const previous = buildReviewRows({ files: [A], getContent: () => BINARY });
    const next = buildReviewRows({ files: [A, B], getContent: () => BINARY });
    const tail = previous.at(-1);
    expect(tail?.kind).toBe('tail');

    expect(findReplacementRow({ key: tail?.key ?? '', offset: -40, previous, next })).toMatchObject({
        row: { key: getReviewHeaderKey(B.path) },
        offset: -40,
    });
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

    const shown = getGapLinesToShow(gap, 5);
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

test('a gap at the end of the file shows from its top, none being below it', () => {
    const rows = buildFileLineRows({ path: A.path, diff: DIFF, layout: 'split' });
    const gap = rows.findLast(row => row.kind === 'gap');
    if (gap?.kind !== 'gap') {
        throw new Error('No gap');
    }

    expect(gap.atFileEnd).toBe(true);
    expect(getGapLinesToShow(gap, 2)).toEqual({ start: gap.range.afterStart, end: gap.range.afterStart + 2 });
    expect(getGapLinesToShow(gap, 1000)).toEqual({ start: gap.range.afterStart, end: gap.range.afterEnd });
});

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
