import { expect, test } from 'bun:test';

import { createThreadRowSample, sampleThread } from '@/testing/sampleThreads.js';

import type { ReviewThreadRow } from '../buildReviewRows.js';
import { normalizeCursor } from './normalizeCursor.js';
import type { ReviewCursor } from './ReviewCursor.js';

const ROW = createThreadRowSample({ kind: 'onLine', inline: 'right' });
const KEY = ROW.key;

test('a thread shown whole puts a bare cursor on its first comment, or its last when entered from below', () => {
    expect(normalizeCursor({ row: ROW, cursor: { key: KEY }, isThreadWhole: whole })).toEqual(on('C_1'));
    expect(normalizeCursor({ row: ROW, cursor: { key: KEY }, isThreadWhole: whole, fromBelow: true })).toEqual(
        on('C_2'),
    );
});

test('a cursor already a stop stays the same object; folded, the thread takes it back to its bare key', () => {
    const cursor = on('C_2');
    const bare = { key: KEY };

    expect(normalizeCursor({ row: ROW, cursor, isThreadWhole: whole })).toBe(cursor);
    expect(normalizeCursor({ row: ROW, cursor: bare, isThreadWhole: folded })).toBe(bare);
    expect(normalizeCursor({ row: ROW, cursor, isThreadWhole: folded })).toEqual(bare);
});

test('a comment gone gives the cursor to the next comment left, else the previous, else the bare thread', () => {
    const previousComments = ['C_1', 'C_2', 'C_3'];
    const normalize = (row: ReviewThreadRow, cursor: ReviewCursor) =>
        normalizeCursor({ row, cursor, isThreadWhole: whole, previousComments });

    expect(normalize(withComments('C_1', 'C_3'), on('C_2'))).toEqual(on('C_3'));
    expect(normalize(withComments('C_1', 'C_2'), on('C_3'))).toEqual(on('C_2'));
    expect(normalize(withComments(), on('C_2'))).toEqual({ key: KEY });
});

function on(comment: string): ReviewCursor {
    return { key: KEY, comment };
}

/** {@link ROW} with only the comments of these ids. */
function withComments(...ids: string[]): ReviewThreadRow {
    const [comment] = sampleThread().comments;
    const comments = ids.map(id => ({ ...comment!, id }));
    return createThreadRowSample({ kind: 'onLine', inline: 'right', thread: sampleThread({ comments }) });
}

function folded() {
    return false;
}

function whole() {
    return true;
}
