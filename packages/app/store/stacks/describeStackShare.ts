import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';

import type { StackBlocker, StackDescription } from './describeStack.js';

/**
 * What an entry holding a share of a stack's open pull requests says of it (D3, D16, SP24) — the stack spread over
 * groups: "2 of 4", the share's pips filled and the others hollow, and whether the share can merge.
 */
export interface StackShare {
    /** How many pull requests the share holds: the "2" of "2 of 4". */
    readonly count: number;
    /** How the share stands; `null` where only the whole stack's sentence is true (a rebase, a closed one, review asked). */
    readonly state: StackShareState | null;
}

/** How a share stands (SP24): "Both ready", or what holds it — "#1206 blocks", in the colour of what holds it. */
export type StackShareState = StackShareReadyState | StackShareHeldState;

/** Every pull request of the share can merge, together with every one before it. */
export interface StackShareReadyState {
    readonly kind: 'ready';
    readonly count: number;
}

/** A pull request of the share, or one before it, cannot merge: the stack's blocker, which holds the share back. */
export interface StackShareHeldState {
    readonly kind: 'held';
    readonly blocker: StackBlocker;
}

/**
 * The share of a stack the given pull requests hold, or `null` when they hold every open one: the entry is then the
 * stack's, whole. Worked out from the whole stack's description: a pull request merges only together with every one
 * before it (D5), so a share is ready only when the stack is ready up to its last pull request.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function describeStackShare(
    description: StackDescription,
    pullRequests: readonly PullRequestItem[],
): StackShare | null {
    const open: PullRequestItem[] = [];
    for (const pip of description.pips) {
        if (pip.kind !== 'missing' && isOpenPullRequest(pip.pullRequest)) {
            open.push(pip.pullRequest);
        }
    }

    const held = new Set(pullRequests.map(pr => pr.id));
    if (open.every(pr => held.has(pr.id))) {
        return null;
    }

    return { count: pullRequests.length, state: getState() };

    function getState(): StackShareState | null {
        const { state } = description;
        switch (state.kind) {
            case 'ready':
                return { kind: 'ready', count: pullRequests.length };
            case 'held': {
                // The last of the share, counted among the open ones from the lowest: ready only below the stack's blocker.
                const last = open.findLastIndex(pr => held.has(pr.id));
                return last < state.readyCount
                    ? { kind: 'ready', count: pullRequests.length }
                    : { kind: 'held', blocker: state.blocker };
            }
            default:
                return null;
        }
    }
}
