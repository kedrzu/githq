import { expect, test } from 'bun:test';

import type { PullRequestItem } from '@/store/ItemTypes.js';
import { samplePullRequest } from '@/testing/sampleItems.js';

import { findStackFirstQueued } from './findStackFirstQueued.js';

function member(id: string, position: number, change: Partial<PullRequestItem> = {}): PullRequestItem {
    return {
        ...samplePullRequest(id),
        stack: { id: 'S_1', number: 1, size: 3, position },
        mergeQueueEntry: {
            position,
            state: 'QUEUED',
            estimatedTimeToMerge: null,
            enqueuedAt: '2026-11-03T10:00:00Z',
            enqueuer: 'someone',
        },
        ...change,
    };
}

test('finds the first open one in the queue, wherever the rows hold it', () => {
    const first = member('PR_2', 2);

    const items = [member('PR_3', 3), first, member('PR_1', 1, { state: 'MERGED', merged: true })];

    expect(findStackFirstQueued('S_1', items)).toBe(first);
});

test('finds nothing of another stack, or of a stack out of the queue', () => {
    expect(findStackFirstQueued('S_2', [member('PR_1', 1)])).toBeUndefined();
    expect(findStackFirstQueued('S_1', [member('PR_1', 1, { mergeQueueEntry: null })])).toBeUndefined();
});
