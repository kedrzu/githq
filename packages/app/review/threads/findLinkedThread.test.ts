import { expect, test } from 'bun:test';

import { createThreadRowSample, sampleThread } from '@/testing/sampleThreads.js';

import type { FindLinkedThreadParams } from './findLinkedThread.js';
import { findLinkedThread, parseThreadAnchor } from './findLinkedThread.js';

const THREAD = sampleThread({ id: 'T_1', path: 'src/old.ts' });
const PLACED = createThreadRowSample({ kind: 'gone', diffHunk: '', thread: THREAD }).placement;
const READY: FindLinkedThreadParams = {
    anchor: 'discussion_r2',
    threads: [THREAD],
    threadsState: { kind: 'ready' },
    placements: new Map([['src/new.ts', [PLACED]]]),
    listEnd: 'certain',
};

test("a fragment names a comment on the code by a comment's anchor or by GitHub's files page's", () => {
    expect(parseThreadAnchor('#discussion_r7')).toBe('discussion_r7');
    expect(parseThreadAnchor('#r7')).toBe('discussion_r7');
    for (const hash of ['', '#', '#issuecomment-7', '#discussion_', '#r7x', '#pullrequestreview-7']) {
        expect(parseThreadAnchor(hash)).toBeNull();
    }
});

test('any comment of the thread finds it, under the path of the file it shows in, a renamed one its new path', () => {
    expect(findLinkedThread(READY)).toEqual({ kind: 'placed', path: 'src/new.ts', threadId: 'T_1' });
    expect(findLinkedThread({ ...READY, anchor: 'discussion_r1' })).toEqual({
        kind: 'placed',
        path: 'src/new.ts',
        threadId: 'T_1',
    });
});

test('it waits while the threads are read, or for the list of files to bring the file of one not placed yet', () => {
    expect(findLinkedThread({ ...READY, threads: [], threadsState: { kind: 'loading' } })).toEqual({ kind: 'waiting' });
    expect(findLinkedThread({ ...READY, placements: new Map(), listEnd: 'growing' })).toEqual({ kind: 'waiting' });
});

test('it gives up on a thread there is not, or that no file will show', () => {
    expect(findLinkedThread({ ...READY, anchor: 'discussion_r9' })).toEqual({ kind: 'missing' });
    expect(
        findLinkedThread({ ...READY, threads: [], threadsState: { kind: 'failed', error: new Error('no') } }),
    ).toEqual({ kind: 'missing' });
    expect(findLinkedThread({ ...READY, placements: new Map(), listEnd: 'uncertain' })).toEqual({ kind: 'missing' });
});
