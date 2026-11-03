import type { StackMerge } from './StackMergeTypes.js';

/**
 * Nothing of a stack's range can land wherever the line is: the copy is incomplete (D7), or the stack needs a rebase
 * (D21). Held or closed, those before the holder still can.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isWholeRangeBlocked(merge: StackMerge): boolean {
    return merge.block?.kind === 'incomplete' || merge.block?.kind === 'needsRebase';
}
