import { expect, test } from 'bun:test';

import type { Freshness } from '@/sync/Freshness.js';

import { getThreadPositionFreshness } from './getThreadPositionFreshness.js';
import type { ThreadPositionFreshness } from './getThreadPositionFreshness.js';

const POSITION: ThreadPositionFreshness = { kind: 'threadPosition', position: 2, total: 7, open: 5 };

test('a thread focused says where it is over a review that is merely up to date or still arriving', () => {
    const quiet: readonly Freshness[] = [
        { kind: 'fresh', checkedAt: 100 },
        { kind: 'partial' },
        { kind: 'fetchingFiles', here: 1, total: 3, first: null, listComplete: true },
    ];
    for (const freshness of quiet) {
        expect(getThreadPositionFreshness(freshness, POSITION)).toEqual(POSITION);
    }
});

test('a warning about the review is not hidden by a thread focused', () => {
    const warnings: readonly Freshness[] = [
        { kind: 'filesPaused', waiting: 2, until: 500 },
        { kind: 'paused', since: null, until: 500 },
        { kind: 'filesUnread' },
        { kind: 'threadsUnread' },
        { kind: 'threadsPaused', until: 500 },
        { kind: 'filesCapped', listed: 3000, total: 4812 },
    ];
    for (const freshness of warnings) {
        expect(getThreadPositionFreshness(freshness, POSITION)).toEqual(freshness);
    }
});
