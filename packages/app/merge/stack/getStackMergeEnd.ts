import type { StackDescription } from '@/store/stacks/describeStack.js';

import { getStackMerge } from './getStackMerge.js';

/** Where a stack's merge panel opens. */
export interface GetStackMergeEndParams {
    readonly description: StackDescription;
    /** The pull request the panel was opened on; `null` from the stack's entry. */
    readonly openedOn: number | null;
}

/**
 * Where the line sits when a stack's merge panel opens: from the entry on the whole stack, from a pull request on
 * it — everything up to it (stacked PRs D11). Held before that, on the last one that can land, so `⌘↵` lands those
 * (D19, SP45); where none can, it stays put and says what holds the first. `null` when nothing is open.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getStackMergeEnd(params: GetStackMergeEndParams): number | null {
    const merge = getStackMerge({ description: params.description, end: params.openedOn });
    const held = merge.open[merge.canLand - 1];
    if (held && merge.going.length > merge.canLand) {
        return held.number;
    }

    return merge.going.at(-1)?.number ?? null;
}
