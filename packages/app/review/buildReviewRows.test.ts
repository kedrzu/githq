import { expect, test } from 'bun:test';

import {
    buildFileLineRows,
    buildReviewRows,
    estimateReviewRowHeight,
    findReplacementRow,
    getReviewHeaderKey,
    getReviewRowPath,
} from './buildReviewRows.js';
import type { ReviewFileContent, ReviewRow } from './buildReviewRows.js';
import { computeFileDiff } from './diff/computeFileDiff.js';
import type { ReviewFile } from './ReviewFiles.js';

const A = sampleFile('src/a.ts');
const B = sampleFile('src/b.ts');
const BEFORE = lines(40);
const AFTER = BEFORE.replace('line 20\n', 'line 20 changed\nline 20b\n');
const DIFF = computeFileDiff(BEFORE, AFTER, { ignoreWhitespace: false });

test('each file is its header, what shows under it and its end; the last is followed by room to land on', () => {
    const rows = buildReviewRows({
        files: [A, B],
        getContent: file => (file === A ? { kind: 'placeholder' } : { kind: 'binary' }),
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
    const inA = buildFileLineRows(A.path, DIFF, 'split');
    const inB = buildFileLineRows(B.path, DIFF, 'split');
    const unified = buildFileLineRows(A.path, DIFF, 'unified');

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

    const replacement = findReplacementRow(held.key, split, unified);

    expect(replacement).toMatchObject({ kind: 'line', line: { layout: 'unified', newLine: 19 } });
});

test('a deleted line held has no newer line: it goes by the older one', () => {
    const unified = buildAll([A], 'unified');
    const split = buildAll([A], 'split');
    const deleted = unified.find(row => row.kind === 'line' && row.line.layout === 'unified' && row.line.sign === '-');
    if (!deleted) {
        throw new Error('The sample has a deleted line');
    }

    const replacement = findReplacementRow(deleted.key, unified, split);

    expect(replacement).toMatchObject({ kind: 'line', line: { left: { line: 20, kind: 'deleted' } } });
});

test('a line that whitespace hides gives way to the next one shown', () => {
    const before = 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nk\nl\nm\nn\no\np\n';
    const after = before.replace('b\n', '  b\n').replace('o\n', 'oo\n');
    const shown = rowsOf(computeFileDiff(before, after, { ignoreWhitespace: false }));
    const hidden = rowsOf(computeFileDiff(before, after, { ignoreWhitespace: true }));
    const held = shown.find(row => row.kind === 'line' && row.line.layout === 'split' && row.line.right?.line === 2);
    if (!held) {
        throw new Error('The sample shows line 2');
    }

    expect(findReplacementRow(held.key, shown, hidden)).toMatchObject({ kind: 'gap', firstLine: 1, lastLine: 11 });
});

test('a placeholder held gives way to the first row of the file that arrived', () => {
    const waiting = buildReviewRows({ files: [A, B], getContent: () => ({ kind: 'placeholder' }) });
    const arrived = buildAll([A, B], 'split');
    const held = waiting.find(row => row.kind === 'placeholder');
    if (!held) {
        throw new Error('The sample has a placeholder');
    }

    expect(findReplacementRow(held.key, waiting, arrived)?.key).toBe(arrived[1]?.key ?? '');
});

test('the room under what was the last file gives way to what now follows that file, as more of the list arrives', () => {
    const previous = buildReviewRows({ files: [A], getContent: () => ({ kind: 'binary' }) });
    const next = buildReviewRows({ files: [A, B], getContent: () => ({ kind: 'binary' }) });
    const tail = previous.at(-1);
    expect(tail?.kind).toBe('tail');

    expect(findReplacementRow(tail?.key ?? '', previous, next)?.key).toBe(getReviewHeaderKey(B.path));
});

test('nothing replaces a row still there, or one of a file that is gone', () => {
    const split = buildAll([A, B], 'split');
    const header = split[0];
    const line = lineWithAfter(split, 19);
    if (!header) {
        throw new Error('The sample has a header');
    }

    expect(findReplacementRow(header.key, split, split)).toBeNull();
    expect(findReplacementRow(line.key, split, buildAll([B], 'unified'))).toBeNull();
});

function buildAll(files: readonly ReviewFile[], layout: 'split' | 'unified'): ReviewRow[] {
    return buildReviewRows({
        files,
        getContent: (file): ReviewFileContent => ({
            kind: 'lines',
            rows: buildFileLineRows(file.path, DIFF, layout),
        }),
    });
}

function rowsOf(diff: typeof DIFF): ReviewRow[] {
    return buildReviewRows({
        files: [A],
        getContent: () => ({ kind: 'lines', rows: buildFileLineRows(A.path, diff, 'split') }),
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
