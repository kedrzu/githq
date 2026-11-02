import { isMergedPullRequest } from '@/store/isMergedPullRequest.js';
import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';
import type { StackPullRequestPip } from '@/store/stacks/describeStack.js';

import type {
    StackMerge,
    StackMergeOutcome,
    StackMergePullRequestRow,
    StackMergeRow,
    StackMergeRowState,
} from './StackMergeTypes.js';

/** What the rows of a stack's merge panel are worked out from. */
export interface GetStackMergeRowsParams {
    readonly merge: StackMerge;
    /** How the stack's last merge that did not end merged reads; `null` for none. */
    readonly outcome: StackMergeOutcome | null;
    /** A merge is sent and GitHub has not answered yet: the panel stays as it was (PM32a), none being merged yet. */
    readonly sending: boolean;
}

/**
 * The rows of a stack's merge panel, first to last (stacked PRs D11, D18): each pull request with what it says, those
 * going with the merge before the line, later ones dimmed; places the copy does not hold yet folded into one row each
 * run (SP50). After a merge that did not end merged there is no line: each says what is true of it (SP59–SP62).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getStackMergeRows(params: GetStackMergeRowsParams): StackMergeRow[] {
    const { merge, outcome, sending } = params;
    // Nothing lands while the whole range is blocked (D7, D21): none is marked as going then.
    const blocked = merge.block?.kind === 'incomplete' || merge.block?.kind === 'needsRebase';
    const goingIds = new Set(merge.going.map(pr => pr.id));
    const { holder } = merge;
    const holderIndex = merge.members.findIndex(
        pip => pip.kind !== 'missing' && pip.pullRequest.number === holder?.number,
    );
    const lastGoingIndex = merge.members.findIndex(
        pip => pip.kind !== 'missing' && pip.pullRequest.id === merge.top?.id,
    );
    // Where a merge that did not end merged stopped, or the one with a new commit: those after it are still open.
    const stopNumber = getStopNumber();
    const stopIndex = merge.members.findIndex(pip => pip.kind !== 'missing' && pip.pullRequest.number === stopNumber);

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
        const inRange = outcome === null && goingIds.has(pullRequest.id);
        const after =
            outcome === null ? lastGoingIndex >= 0 && index > lastGoingIndex : stopIndex >= 0 && index > stopIndex;
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

        switch (outcome?.kind) {
            case undefined:
                break;
            case 'reading':
                return { kind: 'notKnown' };
            case 'stopped':
                return getStoppedState(index, { kind: 'refused' });
            case 'headMoved':
                if (index < stopIndex) {
                    return isOpenPullRequest(pullRequest) ? { kind: 'notMerged' } : own;
                }

                return getStoppedState(index, { kind: 'newCommit' });
            case 'refused':
            case 'unknown':
                return own;
        }

        if (pullRequest.merging && !sending) {
            return { kind: 'merging' };
        }

        if (holder && holderIndex >= 0 && index > holderIndex) {
            return pip.kind === 'ready' ? { kind: 'heldBy', number: holder.number } : { kind: 'blocked' };
        }

        return inRange || index === holderIndex || !isOpenPullRequest(pullRequest) ? own : { kind: 'staysOpen' };

        function getStoppedState(at: number, stop: StackMergeRowState): StackMergeRowState {
            if (at === stopIndex) {
                return stop;
            }

            return at > stopIndex && isOpenPullRequest(pullRequest) ? { kind: 'stillOpen' } : own;
        }
    }

    function getStopNumber(): number | null {
        switch (outcome?.kind) {
            case 'stopped':
                return outcome.at.number;
            case 'headMoved':
                return outcome.pullRequest.number;
            default:
                return null;
        }
    }
}
