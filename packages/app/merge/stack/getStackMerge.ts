import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';
import type { StackDescription, StackPullRequestPip } from '@/store/stacks/describeStack.js';
import { findStackHolder } from '@/store/stacks/findStackHolder.js';
import { toStackBlocker } from '@/store/stacks/toStackBlocker.js';

import type { StackMerge, StackMergeBlock, StackMergeQueue, StackRebaseCause } from './StackMergeTypes.js';

/** What a stack's merge is worked out from. */
export interface GetStackMergeParams {
    /** The stack as `describeStack` reads it from the local copy: its members in their own states, and its state. */
    readonly description: StackDescription;
    /**
     * The number of the pull request the line sits on; `null` for the whole stack. One not open moves to the last
     * open one before it (the first open one when there is none), one not in the stack to the last open one.
     */
    readonly end: number | null;
    /** Its pull requests this session saw in a merge queue: one with no entry now and still open was thrown out. */
    readonly queued?: readonly string[];
}

/**
 * A stack's merge up to a line: the range always starts at the first open member and runs, without a gap, to the
 * line — GitHub merges "a contiguous group starting from the lowest unmerged pull request" (stacked PRs D11). What
 * can land is the members' own states combined, as the entry reads them (D5): GitHub's status of one does not
 * account for those before it.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getStackMerge(params: GetStackMergeParams): StackMerge {
    const { description, queued = [] } = params;
    const members = description.pips.filter((pip): pip is StackPullRequestPip => pip.kind !== 'missing');
    const open = members.filter(pip => isOpenPullRequest(pip.pullRequest)).map(pip => pip.pullRequest);
    const going = open.slice(0, getEndIndex() + 1);
    const wholeBlock = getWholeBlock();
    // The held line (SP45), as the entry reads it (D5); nothing to work out while the whole range is blocked.
    const { canLand, holder } = wholeBlock ? { canLand: 0, holder: null } : findStackHolder(members);
    const block = wholeBlock ?? getRangeBlock();

    return {
        members: description.pips,
        open,
        going,
        canLand,
        holder: holder ? toStackBlocker(holder) : null,
        checksOf: holder?.pullRequest ?? open[0] ?? null,
        freshChecks: description.landed > 0 && canLand === 0 && holder?.kind === 'moving',
        block,
        queue: getQueue(),
    };

    function getQueue(): StackMergeQueue | null {
        const first = open.find(pr => pr.mergeQueueEntry?.state === 'UNMERGEABLE');
        const thrownOut = first ?? open.find(pr => queued.includes(pr.id) && !pr.mergeQueueEntry && !pr.merging);
        if (thrownOut) {
            const left = open.slice(open.indexOf(thrownOut) + 1);
            const stillThere = thrownOut.mergeQueueEntry !== null || left.some(pr => pr.mergeQueueEntry !== null);
            return { kind: 'out', thrownOut, left, stillThere };
        }

        return open[0]?.mergeQueueEntry ? { kind: 'in' } : null;
    }

    function getEndIndex(): number {
        const at = members.findIndex(pip => pip.pullRequest.number === params.end);
        if (params.end === null || at < 0) {
            return open.length - 1;
        }

        const openUpToEnd = members.slice(0, at + 1).filter(pip => isOpenPullRequest(pip.pullRequest)).length;
        return open.length === 0 ? -1 : Math.max(openUpToEnd - 1, 0);
    }

    function getWholeBlock(): StackMergeBlock | null {
        const { state } = description;
        switch (state.kind) {
            case 'incomplete':
                return { kind: 'incomplete' };
            case 'needsRebase':
                return {
                    kind: 'needsRebase',
                    behindNumber: state.behindNumber,
                    cause: getRebaseCause(state.behindNumber),
                };
            default:
                return null;
        }
    }

    /** The holder stops the range once the line reaches past what can land; it sits before the line then. */
    function getRangeBlock(): StackMergeBlock | null {
        if (!holder || going.length <= canLand) {
            return null;
        }

        return { kind: holder.kind === 'closed' ? 'closed' : 'held' };
    }

    function getRebaseCause(behindNumber: number): StackRebaseCause {
        const at = members.findIndex(pip => pip.pullRequest.number === behindNumber);
        const before = members[at - 1]?.pullRequest;
        const behind = members[at]?.pullRequest;
        return before && behind && before.headRefName === behind.baseRefName
            ? { kind: 'earlierPush', pushedNumber: before.number }
            : { kind: 'targetMoved' };
    }
}
