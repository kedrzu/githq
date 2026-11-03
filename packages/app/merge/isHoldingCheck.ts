import type { MergeCheck } from './MergeTypes.js';

/**
 * A check holding the merge: required, and failing or still running.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isHoldingCheck(check: MergeCheck): boolean {
    return check.isRequired && (check.state === 'failing' || check.state === 'pending');
}
