import { expect, test } from 'bun:test';

import type { Freshness } from '@/sync/Freshness.js';

import { getReviewFreshness } from './getReviewFreshness.js';
import type { ReviewFreshnessFiles } from './getReviewFreshness.js';

const NOTHING_LEFT = { here: 2, total: 2 };

test("the allowance says first, while files wait; then files arriving, by name when a jump asks for one; then GitHub's cap; then up to date", () => {
    const waiting = { progress: { here: 1, total: 3 } };
    const paused: Freshness = { kind: 'filesPaused', waiting: 2, until: 500 };
    expect(read({ ...waiting, pausedUntil: 500 })).toEqual(paused);
    const fetching: Freshness = { kind: 'fetchingFiles', here: 1, total: 3, first: null, listComplete: true };
    expect(read(waiting)).toEqual(fetching);
    expect(read({ ...waiting, fetchingFirst: 'src/db/schema.ts' })).toEqual({ ...fetching, first: 'schema.ts' });

    const capped: Freshness = { kind: 'filesCapped', listed: 2, total: 4812 };
    expect(read({ changedFiles: 4812 })).toEqual(capped);
    expect(read({})).toEqual({ kind: 'fresh', checkedAt: 100 });
});

test('a pause nothing waits on is no concern of the screen once GitHub has answered; before it has, it is', () => {
    expect(read({ pausedUntil: 500 })).toEqual({ kind: 'fresh', checkedAt: 100 });
    expect(read({ pausedUntil: 500, checkedAt: null })).toEqual({ kind: 'paused', since: null, until: 500 });
});

function read(overrides: Partial<ReviewFreshnessFiles>) {
    return getReviewFreshness({
        list: { kind: 'ready' },
        files: [
            { path: 'a.ts', previousPath: null, changeType: 'ADDED', additions: 1, deletions: 0, viewed: 'UNVIEWED' },
            { path: 'b.ts', previousPath: null, changeType: 'ADDED', additions: 1, deletions: 0, viewed: 'UNVIEWED' },
        ],
        progress: NOTHING_LEFT,
        pausedUntil: null,
        listComplete: true,
        fetchingFirst: null,
        checkedAt: 100,
        changedFiles: 2,
        listFailing: false,
        ...overrides,
    });
}
