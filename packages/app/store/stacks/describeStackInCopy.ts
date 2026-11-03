import type { Item, PullRequestItem } from '@/store/ItemTypes.js';

import { describeStack } from './describeStack.js';
import type { StackDescription } from './describeStack.js';
import { groupStacks } from './groupStacks.js';

/** The stack {@link describeStackInCopy} reads. */
export interface DescribeStackInCopyParams {
    /** The stack's node id. */
    readonly stackId: string;
    /** The pull request it is read for, as shown: opened from outside the lists, the copy's rows don't hold it. */
    readonly item: PullRequestItem;
    /** The copy's rows. */
    readonly items: readonly Item[];
    /** The signed-in user's login: their own stack never reads as asking for their review. */
    readonly viewerLogin: string;
    /** An item of the local copy by id — the issues a stack closes, for its name. */
    readonly getItem: (id: string) => Item | undefined;
    /** As it was before a merge was sent: while it is sent the merge panel stays as it was (merging PM32a). */
    readonly withoutMerging?: boolean;
}

/**
 * The stack of a pull request as the local copy holds it, no request (stacked PRs D7, D17): `null` when the copy
 * holds none of it.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function describeStackInCopy(params: DescribeStackInCopyParams): StackDescription | null {
    const { stackId, item, items, viewerLogin, getItem, withoutMerging } = params;
    const others = items.filter(
        (other): other is PullRequestItem =>
            other.kind === 'pullRequest' && other.stack?.id === stackId && other.id !== item.id,
    );
    const members = [...others, item];
    const found = groupStacks(withoutMerging ? members.map(pr => ({ ...pr, merging: undefined })) : members).get(
        stackId,
    );
    return found ? describeStack({ stack: found, viewerLogin, getItem }) : null;
}
