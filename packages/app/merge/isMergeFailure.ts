import type { EditFailure } from '@/edits/EditQueue.js';

/**
 * Whether the failed edit is a merge: it is said by a toast of its own, with the way back to the merge panel
 * (`MergeToasts`), not by the failed edits' one.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isMergeFailure(failure: EditFailure): boolean {
    return failure.failed[0]?.edit.subject.kind === 'merged';
}
