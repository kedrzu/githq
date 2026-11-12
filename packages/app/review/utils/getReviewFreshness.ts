import { assertNever } from '@nzyme/utils/assertNever.js';

import type { Freshness } from '@/sync/Freshness.js';

import type { PullRequestFiles } from '../ReviewFiles.js';
import { getFileName } from './getFileName.js';

/** What {@link getReviewFreshness} tells a review by. */
export type ReviewFreshnessFiles = Pick<
    PullRequestFiles,
    | 'changedFiles'
    | 'checkedAt'
    | 'fetchingFirst'
    | 'files'
    | 'list'
    | 'listComplete'
    | 'listFailing'
    | 'patchesProgress'
    | 'pausedUntil'
    | 'progress'
    | 'threadsState'
>;

/**
 * What the status bar says of a review (CR60–CR68): the allowance holding its files back first, then the file a jump
 * fetches ahead of the rest, then its patches being read (CR115), then its files arriving, then what GitHub won't list
 * or the threads it didn't give, and only then that it is up to date.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getReviewFreshness(files: ReviewFreshnessFiles): Freshness {
    const { list, pausedUntil, listComplete, fetchingFirst, checkedAt, changedFiles } = files;
    const { here, total } = files.progress;
    switch (list.kind) {
        case 'loading':
            return { kind: 'partial' };
        case 'failed':
        case 'gone':
            return { kind: 'filesUnread' };
        case 'paused':
            return { kind: 'paused', since: null, until: list.until };
        case 'ready':
            break;
        default:
            return assertNever(list);
    }

    if (pausedUntil !== null && here < total) {
        return { kind: 'filesPaused', waiting: total - here, until: pausedUntil };
    }

    // What the reader just did comes before what the screen does by itself.
    if (here < total && fetchingFirst !== null) {
        return { kind: 'fetchingFiles', here, total, first: getFileName(fetchingFirst), listComplete };
    }

    if (files.patchesProgress) {
        return { kind: 'readingChanges', ...files.patchesProgress };
    }

    if (here < total) {
        return { kind: 'fetchingFiles', here, total, first: null, listComplete };
    }

    if (files.listFailing) {
        return { kind: 'filesUnread' };
    }

    if (files.threadsState.kind === 'failed') {
        return { kind: 'threadsUnread' };
    }

    if (files.threadsState.kind === 'paused') {
        return { kind: 'threadsPaused', until: files.threadsState.until };
    }

    if (listComplete && changedFiles !== null && changedFiles > files.files.length) {
        return { kind: 'filesCapped', listed: files.files.length, total: changedFiles };
    }

    if (checkedAt !== null) {
        return { kind: 'fresh', checkedAt };
    }

    return pausedUntil === null ? { kind: 'partial' } : { kind: 'paused', since: null, until: pausedUntil };
}
