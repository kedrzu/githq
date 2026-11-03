import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';

import type { StackPullRequestPip } from './describeStack.js';

/** How far a stack can land, as {@link findStackHolder} works it out. */
export interface StackHold {
    /** How many open members, from the first, can land now: each only together with all before it. */
    readonly canLand: number;
    /** The first member that cannot land and keeps open ones from it; `null` when every open one can land. */
    readonly holder: StackPullRequestPip | null;
}

/**
 * How far a stack can land as it is (the entry's held sentence, D5; the merge panel's held line, SP45): every member
 * from the first not merged until the first that cannot land — one being merged is on its way to land. A closed one
 * holds only those after it that are still open: last in the stack, it holds nothing. Over a stack's own states: not
 * for one incomplete or needing a rebase, whose pips say something else.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function findStackHolder(pips: readonly StackPullRequestPip[]): StackHold {
    const lastOpen = pips.findLastIndex(pip => isOpenPullRequest(pip.pullRequest));
    let canLand = 0;
    for (const pip of pips.slice(0, lastOpen + 1)) {
        if (pip.kind === 'ready' || pip.kind === 'merging') {
            canLand++;
        } else if (pip.kind !== 'merged') {
            return { canLand, holder: pip };
        }
    }

    return { canLand, holder: null };
}
