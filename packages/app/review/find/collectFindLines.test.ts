import { expect, test } from 'bun:test';

import { buildFileLineRows, buildReviewRows } from '../buildReviewRows.js';
import type { ReviewFileContent } from '../buildReviewRows.js';
import type { DiffLayout } from '../diff/buildDiffRows.js';
import { computeFileDiff } from '../diff/computeFileDiff.js';
import type { ReviewFile } from '../ReviewFiles.js';
import { placeThreads } from '../threads/placeThreads.js';
import type { ReviewThread } from '../threads/ReviewThread.js';
import { collectFindLines } from './collectFindLines.js';

const A = sampleFile('src/a.ts');
const B = sampleFile('src/b.ts');
const C = sampleFile('src/c.ts');
const BEFORE = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`).join('\n');
// Lines 20 and 21 changed, and one added after line 30: everything else is unchanged, most of it hidden in gaps.
const AFTER = BEFORE.replace('line 20\nline 21\n', 'needle 20\nneedle 21\n').replace(
    'line 30\n',
    'line 30\nneedle new\n',
);
const DIFF = computeFileDiff({ before: BEFORE, after: AFTER, ignoreWhitespace: false });

test('both layouts count each line of the diff once, the same lines, and never a hidden one', () => {
    const counted = (layout: DiffLayout) =>
        collectFindLines(rowsOf(layout))
            .filter(line => line.counted)
            .map(line => `${line.side}:${line.line}:${line.text}`)
            .toSorted();

    const split = counted('split');

    expect(split).toEqual(counted('unified'));
    // The removed lines on their older side; the added and unchanged ones around the changes on their newer side.
    expect(split).toEqual(
        [
            'before:20:line 20',
            'before:21:line 21',
            ...[17, 18, 19, 22, 23, 24, 28, 29, 30].map(line => `after:${line}:line ${line}`),
            'after:20:needle 20',
            'after:21:needle 21',
            'after:31:needle new',
            ...[31, 32, 33].map(line => `after:${line + 1}:line ${line}`),
        ].toSorted(),
    );
});

test("a split unchanged row's left half is searched for its marks but not counted", () => {
    const row = collectFindLines(rowsOf('split')).filter(line => line.text === 'line 17');

    expect(row.map(({ side, counted }) => ({ side, counted }))).toEqual([
        { side: 'before', counted: false },
        { side: 'after', counted: true },
    ]);
});

test('the code shown for a thread on a hidden line is searched like any line, and counted once in both layouts', () => {
    const threads = placeThreads({ kind: 'open', diff: DIFF, expanded: [] }, [threadOn(5)]);
    const linesOf = (layout: DiffLayout) =>
        collectFindLines(buildFileLineRows({ path: A.path, diff: DIFF, layout, threads })).filter(
            line => line.counted && line.text === 'line 5',
        );

    expect(linesOf('split').map(({ side, line }) => `${side}:${line}`)).toEqual(['after:5']);
    expect(linesOf('unified').map(({ side, line }) => `${side}:${line}`)).toEqual(['after:5']);
});

test('only rows of code are searched: not headers, placeholders or notices', () => {
    const rows = buildReviewRows({
        files: [A, B, C],
        getContent: (file): ReviewFileContent => {
            switch (file) {
                case A:
                    return { kind: 'lines', rows: buildFileLineRows({ path: A.path, diff: DIFF, layout: 'split' }) };
                case B:
                    return { kind: 'placeholder' };
                default:
                    return { kind: 'binary', before: null, after: null };
            }
        },
    });

    const lines = collectFindLines(rows);

    expect(new Set(lines.map(line => line.path))).toEqual(new Set([A.path]));
    expect(lines.length).toBe(collectFindLines(rowsOf('split')).length);
});

function rowsOf(layout: DiffLayout) {
    return buildReviewRows({
        files: [A],
        getContent: () => ({ kind: 'lines', rows: buildFileLineRows({ path: A.path, diff: DIFF, layout }) }),
    });
}

function sampleFile(path: string): ReviewFile {
    return { path, previousPath: null, changeType: 'MODIFIED', additions: 3, deletions: 2, viewed: 'UNVIEWED' };
}

function threadOn(line: number): ReviewThread {
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
    };
}
