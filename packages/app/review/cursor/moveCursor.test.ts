import { expect, test } from 'bun:test';

import { sampleThread } from '@/testing/sampleThreads.js';

import { buildFileLineRows, buildReviewRows, getReviewHeaderKey } from '../buildReviewRows.js';
import type { ReviewRow } from '../buildReviewRows.js';
import { computeFileDiff } from '../diff/computeFileDiff.js';
import type { ReviewFile } from '../ReviewFiles.js';
import { placeThreads } from '../threads/placeThreads.js';
import { moveCursor } from './moveCursor.js';
import type { ReviewCursor } from './ReviewCursor.js';

const A = sampleFile('src/a.ts');
const B = sampleFile('src/b.ts');
const ROWS = buildRows();

test('↓ from the line above a thread lands on the thread, and the next ↓ on the line after it', () => {
    const onThread = moveCursor({ rows: ROWS, cursor: at('19|19'), delta: 1 });

    expect(describe(onThread)).toBe('thread');
    expect(describe(moveCursor({ rows: ROWS, cursor: onThread, delta: 1 }))).toBe('20|20');
    expect(describe(moveCursor({ rows: ROWS, cursor: onThread, delta: -1 }))).toBe('19|19');
});

test('a move passes over what is no stop: a comment box, and a file’s end between its last gap and the next header', () => {
    expect(describe(moveCursor({ rows: ROWS, cursor: at('22|23'), delta: 1 }))).toBe('23|24');
    expect(describe(moveCursor({ rows: ROWS, cursor: { key: getReviewHeaderKey(B.path) }, delta: -1 }))).toBe(
        `gap ${A.path}`,
    );
});

test('a move of several stops goes that many, and stops at the ends of the diff', () => {
    expect(describe(moveCursor({ rows: ROWS, cursor: at('17|17'), delta: 4 }))).toBe('20|20');
    expect(describe(moveCursor({ rows: ROWS, cursor: { key: getReviewHeaderKey(A.path) }, delta: -3 }))).toBe(
        `header ${A.path}`,
    );
    expect(describe(moveCursor({ rows: ROWS, cursor: at('23|24'), delta: 1000 }))).toBe(`gap ${B.path}`);
});

function buildRows() {
    const before = Array.from({ length: 40 }, (_, index) => `line ${index + 1}\n`).join('');
    const after = before.replace('line 20\n', 'line 20 changed\nline 20b\n');
    const diff = computeFileDiff({ before, after, ignoreWhitespace: false });
    const thread = sampleThread({ id: 'T19', path: A.path, line: 19, originalLine: 19 });
    return buildReviewRows({
        files: [A, B],
        getContent: (file): { kind: 'lines'; rows: ReviewRow[] } => ({
            kind: 'lines',
            rows: buildFileLineRows({
                path: file.path,
                diff,
                layout: 'split',
                threads: file === A ? placeThreads({ kind: 'open', diff, expanded: [] }, [thread]) : [],
                comments:
                    file === A
                        ? [{ id: 'box', path: A.path, side: 'after', line: 23, startLine: null, threadId: null }]
                        : [],
            }),
        }),
    });
}

/** The cursor on file A's split row showing these numbers, `left|right`. */
function at(numbers: string): ReviewCursor {
    const row = ROWS.find(other => other.key.startsWith(A.path + '\0') && describe({ key: other.key }) === numbers);
    if (!row) {
        throw new Error(`No row ${numbers}`);
    }

    return { key: row.key };
}

function describe(cursor: ReviewCursor): string {
    const row = ROWS.find(other => other.key === cursor.key);
    if (row?.kind === 'line' && row.line.layout === 'split') {
        return `${row.line.left?.line ?? '-'}|${row.line.right?.line ?? '-'}`;
    }

    return row?.kind === 'thread' ? 'thread' : `${row?.kind} ${cursor.key.split('\0')[0]}`;
}

function sampleFile(path: string): ReviewFile {
    return { path, previousPath: null, changeType: 'MODIFIED', additions: 2, deletions: 1, viewed: 'UNVIEWED' };
}
