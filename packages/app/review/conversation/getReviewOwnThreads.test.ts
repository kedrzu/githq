import { expect, test } from 'bun:test';

import { placeThreads } from '../threads/placeThreads.js';
import type { ReviewThread } from '../threads/ReviewThread.js';
import { sampleThread } from '@/testing/sampleThreads.js';

import { getReviewOwnThreads } from './getReviewOwnThreads.js';

test('a thread is the review of its first comment, not of a reply in another', () => {
    const own = getReviewOwnThreads({
        byFile: new Map([
            ['src/a.ts', placeThreads({ kind: 'collapsed', notLoaded: false }, [threadOf('T_1', 'R_1', ['R_2'])])],
        ]),
        goneEntries: [],
    });

    expect([...own.keys()]).toEqual(['R_1']);
    expect([...(own.get('R_1')?.ids ?? [])]).toEqual(['T_1']);
});

test('resolved only when every thread of the review is', () => {
    const own = getReviewOwnThreads({
        byFile: new Map([
            [
                'src/a.ts',
                placeThreads({ kind: 'collapsed', notLoaded: false }, [
                    threadOf('T_1', 'R_1', [], true),
                    threadOf('T_2', 'R_1', [], false),
                    threadOf('T_3', 'R_2', [], true),
                ]),
            ],
        ]),
        goneEntries: [],
    });

    expect(own.get('R_1')?.resolved).toBe(false);
    expect(own.get('R_2')?.resolved).toBe(true);
});

test('a resolved thread on a file gone from the diff, which has no entry, is counted and has nowhere to land', () => {
    const own = getReviewOwnThreads({
        byFile: new Map([
            ['src/gone.ts', placeThreads({ kind: 'gone' }, [threadOf('T_1', 'R_1', [], true)])],
            [
                'src/kept.ts',
                placeThreads({ kind: 'gone' }, [threadOf('T_2', 'R_2', [], true), threadOf('T_3', 'R_3', [], false)]),
            ],
        ]),
        goneEntries: ['src/kept.ts'],
    });

    expect(own.get('R_1')?.ids.size).toBe(1);
    expect(own.get('R_1')?.paths).toEqual([]);
    // The entry shows its resolved threads too.
    expect(own.get('R_2')?.paths).toEqual(['src/kept.ts']);
});

function threadOf(id: string, reviewId: string, repliesIn: readonly string[], isResolved = false): ReviewThread {
    const [comment] = sampleThread().comments;
    if (!comment) {
        throw new Error('The sample thread has no comment');
    }

    return sampleThread({
        id,
        isResolved,
        comments: [reviewId, ...repliesIn].map(review => ({ ...comment, pullRequestReview: { id: review } })),
    });
}
