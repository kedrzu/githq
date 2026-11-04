import { expect, test } from 'bun:test';

import type { Freshness } from '@/sync/Freshness.js';

import { getReviewPlaceFreshness } from './getReviewPlaceFreshness.js';
import type { ReviewPlaceFreshness } from './getReviewPlaceFreshness.js';

const PLACES: readonly ReviewPlaceFreshness[] = [
    { kind: 'threadPosition', position: 2, total: 7, open: 5 },
    { kind: 'landing', at: 'firstFile', number: 1202, viewed: 9, total: 42, backTo: null },
    { kind: 'landing', at: 'left', number: 1202, file: 'engine.ts', line: 47 },
];

test('a place says itself over a review that is merely up to date or still arriving', () => {
    const quiet: readonly Freshness[] = [
        { kind: 'fresh', checkedAt: 100 },
        { kind: 'partial' },
        { kind: 'fetchingFiles', here: 1, total: 3, first: null, listComplete: true },
    ];
    for (const place of PLACES) {
        for (const freshness of quiet) {
            expect(getReviewPlaceFreshness(freshness, place)).toEqual(place);
        }
    }
});

test('a warning about the review is not hidden by a place', () => {
    const warnings: readonly Freshness[] = [
        { kind: 'filesPaused', waiting: 2, until: 500 },
        { kind: 'paused', since: null, until: 500 },
        { kind: 'filesUnread' },
        { kind: 'threadsUnread' },
        { kind: 'threadsPaused', until: 500 },
        { kind: 'filesCapped', listed: 3000, total: 4812 },
    ];
    for (const place of PLACES) {
        for (const freshness of warnings) {
            expect(getReviewPlaceFreshness(freshness, place)).toEqual(freshness);
        }
    }
});
