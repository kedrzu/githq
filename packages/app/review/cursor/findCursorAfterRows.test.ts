import { expect, test } from 'bun:test';

import { sampleThread } from '@/testing/sampleThreads.js';

import { buildFileLineRows, buildReviewRows, getReviewHeaderKey, getReviewThreadKey } from '../buildReviewRows.js';
import type { ReviewFileContent, ReviewRow } from '../buildReviewRows.js';
import type { DiffLayout, DiffLineRange } from '../diff/buildDiffRows.js';
import { computeFileDiff } from '../diff/computeFileDiff.js';
import type { ReviewFile } from '../ReviewFiles.js';
import type { ReviewCommentTarget } from '../writing/ReviewWriting.js';
import { placeThreads } from '../threads/placeThreads.js';
import { findCursorAfterRows } from './findCursorAfterRows.js';
import type { ReviewCursor } from './ReviewCursor.js';

const A = sampleFile('src/a.ts');
const B = sampleFile('src/b.ts');
const BEFORE = Array.from({ length: 40 }, (_, index) => `line ${index + 1}\n`).join('');
// Line 20 changed and one added after it, line 30 deleted, line 18 only reindented.
const AFTER = BEFORE.replace('line 18\n', '  line 18\n')
    .replace('line 20\n', 'line 20 changed\nline 20b\n')
    .replace('line 30\n', '');
const THREAD = sampleThread({ id: 'T19', path: A.path, line: 19, originalLine: 19 });

test('a cursor whose row is still there stays on it', () => {
    const rows = build();
    const cursor = { key: getReviewThreadKey(A.path, THREAD.id) };

    expect(findCursorAfterRows({ previous: rows, next: build({ layout: 'unified' }), cursor })).toBe(cursor);
});

test('a layout switch keeps the cursor on the row of the same line: the newer one, the older on a deleted line alone', () => {
    const split = build();
    const unified = build({ layout: 'unified' });
    const after = (numbers: string) =>
        describe(unified, findCursorAfterRows({ previous: split, next: unified, cursor: at(split, numbers) }));

    expect(after('20|20')).toBe('-|20');
    expect(after('-|21')).toBe('-|21');
    expect(after('30|-')).toBe('30|-');
    expect(after('28|29')).toBe('28|29');
});

test('a whitespace switch keeps the cursor on the row of the same line, now unchanged', () => {
    const shown = build({ layout: 'unified' });
    const hidden = build({ layout: 'unified', ignoreWhitespace: true });

    expect(describe(hidden, findCursorAfterRows({ previous: shown, next: hidden, cursor: at(shown, '-|18') }))).toBe(
        '18|18',
    );
});

test('a gap whose lines come down from its top keeps the cursor while it hides lines; opened whole, the first line out has it', () => {
    const closed = build();
    const cursor = { key: gapOf(closed, 34).key };
    const opened = (expanded: readonly DiffLineRange[]) =>
        describe(
            build({ expanded }),
            findCursorAfterRows({ previous: closed, next: build({ expanded }), cursor, expanded: 'down' }),
        );

    expect(opened([{ start: 33, end: 38 }])).toBe('gap 39');
    expect(opened([{ start: 33, end: 40 }])).toBe('34|34');
});

test('a gap opened whole from its bottom gives the cursor to the line right above the hunk, the first one out', () => {
    const closed = build();
    const top = gapOf(closed, 1);
    const kept = findCursorAfterRows({
        previous: closed,
        next: build({ expanded: [{ start: 5, end: 14 }] }),
        cursor: { key: top.key },
        expanded: 'up',
    });
    const opened = build({ expanded: [{ start: 0, end: 14 }] });

    expect(kept).toEqual({ key: top.key });
    expect(
        describe(
            opened,
            findCursorAfterRows({ previous: closed, next: opened, cursor: { key: top.key }, expanded: 'up' }),
        ),
    ).toBe('14|14');
});

test("a cursor whose row went goes to its file's header first: collapsed, or not read yet", () => {
    const rows = build();
    const cursor = at(rows, '20|20');
    const header = { key: getReviewHeaderKey(A.path) };

    expect(findCursorAfterRows({ previous: rows, next: build({ a: { kind: 'collapsed' } }), cursor })).toEqual(header);
    expect(findCursorAfterRows({ previous: rows, next: build({ a: { kind: 'placeholder' } }), cursor })).toEqual(
        header,
    );
});

test('a thread gone gives the cursor to the first stop its file shows, past a comment box at its top', () => {
    const rows = build();
    const next = build({
        threads: false,
        comments: [{ id: 'box', path: A.path, side: 'after', line: 3, startLine: null, threadId: null }],
    });
    const cursor = findCursorAfterRows({
        previous: rows,
        next,
        cursor: { key: getReviewThreadKey(A.path, THREAD.id) },
    });

    expect(next[1]?.kind).toBe('comment');
    expect(describe(next, cursor)).toBe('gap 1');
});

test('a file gone gives the cursor to the next file; with none left, there is no cursor', () => {
    const rows = build();
    const onlyB = buildReviewRows({ files: [B], getContent: () => ({ kind: 'collapsed' }) });

    expect(findCursorAfterRows({ previous: rows, next: onlyB, cursor: at(rows, '20|20') })).toEqual({
        key: getReviewHeaderKey(B.path),
    });
    expect(findCursorAfterRows({ previous: rows, next: [], cursor: at(rows, '20|20') })).toBeNull();
});

interface BuildOptions {
    readonly layout?: DiffLayout;
    readonly ignoreWhitespace?: boolean;
    readonly expanded?: readonly DiffLineRange[];
    readonly threads?: boolean;
    readonly comments?: readonly ReviewCommentTarget[];
    /** File A's content when not its lines. */
    readonly a?: ReviewFileContent;
}

/** Files A and B, A with a thread on line 19. */
function build({
    layout = 'split',
    ignoreWhitespace = false,
    expanded = [],
    threads = true,
    comments = [],
    a,
}: BuildOptions = {}): ReviewRow[] {
    const diff = computeFileDiff({ before: BEFORE, after: AFTER, ignoreWhitespace });
    return buildReviewRows({
        files: [A, B],
        getContent: (file): ReviewFileContent =>
            file === A && a
                ? a
                : {
                      kind: 'lines',
                      rows: buildFileLineRows({
                          path: file.path,
                          diff,
                          layout,
                          expanded: file === A ? expanded : [],
                          threads:
                              file === A && threads ? placeThreads({ kind: 'open', diff, expanded }, [THREAD]) : [],
                          comments: file === A ? comments : [],
                      }),
                  },
    });
}

/** The cursor on file A's row showing these numbers, `old|new`. */
function at(rows: readonly ReviewRow[], numbers: string): ReviewCursor {
    const row = rows.find(
        other => other.key.startsWith(A.path + '\0') && describe(rows, { key: other.key }) === numbers,
    );
    if (!row) {
        throw new Error(`No row ${numbers}`);
    }

    return { key: row.key };
}

/** File A's gap whose first newer line is this. */
function gapOf(rows: readonly ReviewRow[], firstLine: number) {
    const gap = rows.find(
        row => row.kind === 'gap' && row.key.startsWith(A.path + '\0') && row.firstLine === firstLine,
    );
    if (gap?.kind !== 'gap') {
        throw new Error(`No gap at ${firstLine}`);
    }

    return gap;
}

function describe(rows: readonly ReviewRow[], cursor: ReviewCursor | null): string | null {
    const row = rows.find(other => other.key === cursor?.key);
    if (!row) {
        return null;
    }

    switch (row.kind) {
        case 'line':
            return row.line.layout === 'split'
                ? `${row.line.left?.line ?? '-'}|${row.line.right?.line ?? '-'}`
                : `${row.line.oldLine ?? '-'}|${row.line.newLine ?? '-'}`;
        case 'gap':
            return `gap ${row.firstLine}`;
        default:
            return `${row.kind} ${row.key.split('\0')[0]}`;
    }
}

function sampleFile(path: string): ReviewFile {
    return { path, previousPath: null, changeType: 'MODIFIED', additions: 2, deletions: 2, viewed: 'UNVIEWED' };
}
