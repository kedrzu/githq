import { assertValue } from '@nzyme/utils/assert.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import { getPullRequestStanding } from '@/store/getPullRequestStanding.js';
import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';
import type { StackBlocker, StackDescription, StackPullRequestPip } from '@/store/stacks/describeStack.js';

import type { StackMerge, StackMergeBlock, StackMergeForward, StackRebaseCause } from './StackMergeTypes.js';

/** What a stack's merge is worked out from. */
export interface GetStackMergeParams {
    /** The stack as `describeStack` reads it from the local copy: its members in their own states, and its state. */
    readonly description: StackDescription;
    /**
     * The number of the pull request the line sits on; `null` for the whole stack. One not open moves to the last
     * open one before it (the first open one when there is none), one not in the stack to the last open one.
     */
    readonly end: number | null;
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
    const { description } = params;
    const members = description.pips.filter((pip): pip is StackPullRequestPip => pip.kind !== 'missing');
    const open = members.filter(pip => isOpenPullRequest(pip.pullRequest)).map(pip => pip.pullRequest);
    const going = open.slice(0, getEndIndex() + 1);
    const top = going.at(-1) ?? null;
    const wholeBlock = getWholeBlock();

    // The held line (SP45): from the first open one, every member until the first that cannot land — one being merged
    // is on its way to land.
    let canLand = 0;
    let holder: StackPullRequestPip | undefined;
    const firstOpen = members.findIndex(pip => isOpenPullRequest(pip.pullRequest));
    if (!wholeBlock && firstOpen >= 0) {
        holder = members.slice(firstOpen).find(pip => pip.kind !== 'ready' && pip.kind !== 'merging');
        canLand = holder ? members.indexOf(holder) - firstOpen : open.length;
    }

    const block = wholeBlock ?? getRangeBlock();

    return {
        members: description.pips,
        open,
        going,
        top,
        canLand,
        holder: holder ? toBlocker(holder) : null,
        block,
        forward: getForward(),
        ordinary: going.length === 1,
    };

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

        if (holder.kind === 'closed') {
            return { kind: 'closed', closedNumber: holder.pullRequest.number };
        }

        return { kind: 'held', blocker: toBlocker(holder) };
    }

    function getRebaseCause(behindNumber: number): StackRebaseCause {
        const at = members.findIndex(pip => pip.pullRequest.number === behindNumber);
        const before = members[at - 1]?.pullRequest;
        const behind = members[at]?.pullRequest;
        return before && behind && before.headRefName === behind.baseRefName
            ? { kind: 'earlierPush', pushedNumber: before.number }
            : { kind: 'targetMoved' };
    }

    function getForward(): StackMergeForward | null {
        if (!top) {
            return null;
        }

        if (!block) {
            return { kind: 'merge', top, count: going.length };
        }

        switch (block.kind) {
            case 'needsRebase':
                // GitHub's "Rebase stack" is on the stack's pull requests' pages: the top open one shows it all.
                return { kind: 'rebaseOnGitHub', url: assertValue(open.at(-1)).url };
            case 'held':
                return holder?.kind === 'draft' ? { kind: 'markReady', pullRequest: holder.pullRequest } : null;
            case 'incomplete':
            case 'closed':
                return null;
            default:
                return assertNever(block);
        }
    }
}

function toBlocker(pip: StackPullRequestPip): StackBlocker {
    return {
        number: pip.pullRequest.number,
        kind: pip.kind,
        waitingForReview: getPullRequestStanding(pip.pullRequest).waitingForReview,
    };
}
