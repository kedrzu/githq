import { isMergedPullRequest } from '@/store/isMergedPullRequest.js';
import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';
import type { StackPullRequestPip } from '@/store/stacks/describeStack.js';

import { isWholeRangeBlocked } from './isWholeRangeBlocked.js';
import type { StackMerge, StackMergePullRequestRow, StackMergeRow, StackMergeRowState } from './StackMergeTypes.js';

/** What the rows of a stack's merge panel are worked out from. */
export interface GetStackMergeRowsParams {
    readonly merge: StackMerge;
    /**
     * GitHub has not said how a merge of two or more of it ended: each says only its own state, none marked as landing,
     * as the merge may land any of them or none (PM29, stacked PRs D11).
     */
    readonly outcomeUnknown?: boolean;
}

/**
 * The rows of a stack's merge panel, first to last (stacked PRs D11, D18): each pull request with what it says, those
 * going with the merge before the line, later ones dimmed; places the copy does not hold yet folded into one row each
 * run (SP50).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getStackMergeRows(params: GetStackMergeRowsParams): StackMergeRow[] {
    const { merge, outcomeUnknown = false } = params;
    // Nothing lands while the whole range is blocked (D7, D21): none is marked as going then.
    const { queue } = merge;
    const blocked = outcomeUnknown || isWholeRangeBlocked(merge) || queue !== null;
    const goingIds = new Set(merge.going.map(pr => pr.id));
    const { holder } = merge;
    const holderIndex = merge.members.findIndex(
        pip => pip.kind !== 'missing' && pip.pullRequest.number === holder?.number,
    );
    const top = merge.going.at(-1);
    const lastGoingIndex = merge.members.findIndex(pip => pip.kind !== 'missing' && pip.pullRequest.id === top?.id);

    const rows: StackMergeRow[] = [];
    for (const [index, pip] of merge.members.entries()) {
        if (pip.kind !== 'missing') {
            rows.push(getRow(pip, index));
            continue;
        }

        const last = rows.at(-1);
        if (last?.kind === 'missing') {
            rows[rows.length - 1] = { kind: 'missing', count: last.count + 1 };
        } else {
            rows.push({ kind: 'missing', count: 1 });
        }
    }

    return rows;

    function getRow(pip: StackPullRequestPip, index: number): StackMergePullRequestRow {
        const { pullRequest } = pip;
        const inRange = goingIds.has(pullRequest.id);
        const after = !outcomeUnknown && queue === null && lastGoingIndex >= 0 && index > lastGoingIndex;
        return {
            kind: 'pullRequest',
            pullRequest,
            state: getState(pip, index, inRange),
            going: inRange && !blocked,
            dimmed: after && !isMergedPullRequest(pullRequest),
        };
    }

    function getState(pip: StackPullRequestPip, index: number, inRange: boolean): StackMergeRowState {
        const { pullRequest } = pip;
        const own: StackMergeRowState = { kind: 'own', pip: pip.kind };
        if (isMergedPullRequest(pullRequest)) {
            return own;
        }

        if (pullRequest.merging) {
            return { kind: 'merging' };
        }

        if (outcomeUnknown) {
            return own;
        }

        if (queue?.kind === 'in' && pullRequest.mergeQueueEntry) {
            return { kind: 'queued', entry: pullRequest.mergeQueueEntry };
        }

        if (queue?.kind === 'out' && queue.thrownOut.id === pullRequest.id) {
            return { kind: 'thrownOut' };
        }

        if (queue?.kind === 'out' && queue.left.some(pr => pr.id === pullRequest.id)) {
            return { kind: 'leftWithIt' };
        }

        if (merge.freshChecks && pip.kind === 'moving') {
            return { kind: 'freshChecks' };
        }

        if (holder && holderIndex >= 0 && index > holderIndex) {
            return pip.kind === 'ready' ? { kind: 'heldBy', number: holder.number } : { kind: 'blocked' };
        }

        return inRange || index === holderIndex || !isOpenPullRequest(pullRequest) ? own : { kind: 'staysOpen' };
    }
}
