import { assertNever } from '@nzyme/utils/assertNever.js';

import type { ReviewWalk } from '@/item/ItemNavigation.js';
import type { Freshness } from '@/sync/Freshness.js';

import { getReviewPlacePath } from '../buildReviewRows.js';
import type { ReviewFile } from '../ReviewFiles.js';
import type { ReviewArrival } from '../useReviewPosition.js';
import { getFileName } from './getFileName.js';

/** Options of {@link getLandingFreshness}. */
export interface GetLandingFreshnessParams {
    readonly arrival: ReviewArrival;
    /** The pull request's. */
    readonly number: number;
    readonly files: readonly ReviewFile[];
    /** How many files it really has; `null` before its list is read. */
    readonly changedFiles: number | null;
    /** The step of `K`/`J` it was reached by, if it was. */
    readonly walkedBy: ReviewWalk | null;
}

/**
 * What the status bar says of where a review opened (CR20, CR25, CR26).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getLandingFreshness(params: GetLandingFreshnessParams): Extract<Freshness, { kind: 'landing' }> {
    const { arrival, number, files, changedFiles, walkedBy } = params;
    switch (arrival.kind) {
        case 'firstFile':
            return {
                kind: 'landing',
                at: 'firstFile',
                number,
                viewed: files.filter(file => file.viewed === 'VIEWED').length,
                total: changedFiles ?? files.length,
                backTo: walkedBy && { key: walkedBy.back, number: walkedBy.from },
            };
        case 'left':
            return {
                kind: 'landing',
                at: 'left',
                number,
                file: getFileName(getReviewPlacePath(arrival.place)),
                line: arrival.place.kind === 'line' ? arrival.place.line : null,
            };
        default:
            return assertNever(arrival);
    }
}
