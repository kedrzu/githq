import { assertNever } from '@nzyme/utils/assertNever.js';

import type { MergeCheck } from './MergeTypes.js';

/** The checks of a pull request's head commit, counted as the merge panel weighs them (merging D13). */
export interface MergeCheckCounts {
    /** How many the base branch requires. */
    readonly required: number;
    readonly requiredFailing: number;
    readonly requiredPending: number;
    /** Not required: they do not stop the merge. */
    readonly otherFailing: number;
    readonly otherPending: number;
    readonly passing: number;
    readonly skipped: number;
}

/**
 * Counts the checks by whether they are required and how they stand: a required one failing or still running holds
 * the merge, any other does not.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function countMergeChecks(checks: readonly MergeCheck[]): MergeCheckCounts {
    let required = 0;
    let requiredFailing = 0;
    let requiredPending = 0;
    let otherFailing = 0;
    let otherPending = 0;
    let passing = 0;
    let skipped = 0;
    for (const check of checks) {
        if (check.isRequired) {
            required++;
        }

        switch (check.state) {
            case 'failing':
                if (check.isRequired) {
                    requiredFailing++;
                } else {
                    otherFailing++;
                }
                break;
            case 'pending':
                if (check.isRequired) {
                    requiredPending++;
                } else {
                    otherPending++;
                }
                break;
            case 'passing':
                passing++;
                break;
            case 'skipped':
                skipped++;
                break;
            default:
                assertNever(check.state);
        }
    }

    return { required, requiredFailing, requiredPending, otherFailing, otherPending, passing, skipped };
}
