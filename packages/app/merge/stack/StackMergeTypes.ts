import type { PullRequestItem } from '@/store/ItemTypes.js';
import type { StackBlocker, StackPip } from '@/store/stacks/describeStack.js';

/**
 * A stack's merge as the panel shows it (stacked PRs D11, D18): every member, the range going — from the first open
 * one up to the line — how far it can go now, what blocks it, and what `⌘↵` does.
 */
export interface StackMerge {
    /** Every place of the stack, first to last, merged, closed and missing ones included, each in its own state. */
    readonly members: readonly StackPip[];
    /** The open members, first to last: the range always starts at the first, and its line sits on one of them. */
    readonly open: readonly PullRequestItem[];
    /** The open members going, from the first open one up to the line. */
    readonly going: readonly PullRequestItem[];
    /**
     * The last one going — the line — and the one the merge is sent to: GitHub lands it with every open one before
     * it. `null` when nothing is open.
     */
    readonly top: PullRequestItem | null;
    /**
     * How many open members, from the first, can land now (SP45): each one only together with all before it, so the
     * count stops at the first that cannot. 0 while the whole range is blocked.
     */
    readonly canLand: number;
    /**
     * The member that holds the next one back — the first after {@link canLand} that cannot land, a closed one
     * included — whether or not it is going; `null` when every open one can land, or the whole range is blocked.
     */
    readonly holder: StackBlocker | null;
    /** What stops the range as the line has it; `null` when every one going can land. */
    readonly block: StackMergeBlock | null;
    /** What `⌘↵` does; `null` when nothing (D7: also while the copy is incomplete). */
    readonly forward: StackMergeForward | null;
    /**
     * Exactly one is going: an ordinary merge of the first open one, with its commit text (SP43, D18) — with two or
     * more each lands under its own title and none is sent (D11).
     */
    readonly ordinary: boolean;
}

/** What stops a stack's range. */
export type StackMergeBlock = StackIncompleteBlock | StackNeedsRebaseBlock | StackClosedBlock | StackHeldBlock;

/** The copy holds fewer members than the stack's size: it never reads ready, and nothing is sent (D7, SP50). */
export interface StackIncompleteBlock {
    readonly kind: 'incomplete';
}

/** The stack must be rebased on github.com before anything merges, wherever the line is (D8, D21, SP46, SP47). */
export interface StackNeedsRebaseBlock {
    readonly kind: 'needsRebase';
    /** The first open member behind its base, above the first open one. */
    readonly behindNumber: number;
    readonly cause: StackRebaseCause;
}

/**
 * Why a stack needs a rebase: a push to the member before the one behind (its base is that member's branch), or the
 * target branch moved under it (its base is not the member before it).
 */
export type StackRebaseCause =
    | { readonly kind: 'earlierPush'; readonly pushedNumber: number }
    | { readonly kind: 'targetMoved' };

/**
 * A member closed without merging sits inside the range: those after it cannot land until the stack is linked
 * again on github.com, those before it can (SP48).
 */
export interface StackClosedBlock {
    readonly kind: 'closed';
    readonly closedNumber: number;
}

/**
 * An open member going cannot land — a draft, failing, waiting for a review — and holds back every one after it
 * (SP45, SP49).
 */
export interface StackHeldBlock {
    readonly kind: 'held';
    readonly blocker: StackBlocker;
}

/** What `⌘↵` does for a stack's range (merging D12, extended). */
export type StackMergeForward = StackMergeRangeForward | StackRebaseForward | StackMarkReadyForward;

/** Merge the range: the merge goes to {@link top}, and lands {@link count} pull requests. */
export interface StackMergeRangeForward {
    readonly kind: 'merge';
    readonly top: PullRequestItem;
    readonly count: number;
}

/** Open the stack's top open pull request on github.com, where "Rebase stack" is (D8, D21). */
export interface StackRebaseForward {
    readonly kind: 'rebaseOnGitHub';
    readonly url: string;
}

/** Mark the draft holding the range ready for review (SP49). */
export interface StackMarkReadyForward {
    readonly kind: 'markReady';
    readonly pullRequest: PullRequestItem;
}
