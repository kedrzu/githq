import type { ItemChecks, PullRequestItem } from '@/store/ItemTypes.js';
import type {
    StackBlocker,
    StackDescription,
    StackPip,
    StackPullRequestPipKind,
} from '@/store/stacks/describeStack.js';

import type { MergeCheck } from '../MergeTypes.js';

/**
 * A stack's merge as the panel shows it (stacked PRs D11, D18): every member, the range going — from the first open
 * one up to the line — how far it can go now, what blocks it, and what `⌘↵` does.
 */
export interface StackMerge {
    /** Every place of the stack, first to last, merged, closed and missing ones included, each in its own state. */
    readonly members: readonly StackPip[];
    /** The open members, first to last: the range always starts at the first, and its line sits on one of them. */
    readonly open: readonly PullRequestItem[];
    /**
     * The open members going, from the first open one up to the line. The last is the one the merge is sent to: GitHub
     * lands it with every open one before it. Exactly one is an ordinary merge, with its commit text (SP43, D18) — with
     * two or more each lands under its own title and none is sent (D11).
     */
    readonly going: readonly PullRequestItem[];
    /**
     * How many open members, from the first, can land now (SP45): each one only together with all before it, so the
     * count stops at the first that cannot. 0 while the whole range is blocked.
     */
    readonly canLand: number;
    /**
     * The member that holds the next one back — the first after {@link canLand} that cannot land, a closed one with
     * open ones after it included — whether or not it is going; `null` when every open one can land, or the whole
     * range is blocked.
     */
    readonly holder: StackBlocker | null;
    /**
     * Whose checks `C` shows with two or more going (SP40–SP45), checks being one pull request's: the {@link holder},
     * else the first open one. `null` when nothing is open.
     */
    readonly checksOf: PullRequestItem | null;
    /**
     * Some landed, and GitHub is checking the first one left, rewritten by that: nothing can land until it is done
     * (SP58).
     */
    readonly freshChecks: boolean;
    /** What stops the range as the line has it; `null` when every one going can land. */
    readonly block: StackMergeBlock | null;
    /** What `⌘↵` does; `null` when nothing (D7: also while the copy is incomplete). */
    readonly forward: StackMergeForward | null;
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

/** Merge the range: the merge goes to the last one going, and lands every one going. */
export interface StackMergeRangeForward {
    readonly kind: 'merge';
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

/** A row of a stack's merge panel, first to last (SP40–SP62). */
export type StackMergeRow = StackMergePullRequestRow | StackMergeMissingRow;

/** A pull request of the stack in the panel's list. */
export interface StackMergePullRequestRow {
    readonly kind: 'pullRequest';
    readonly pullRequest: PullRequestItem;
    readonly state: StackMergeRowState;
    /** It lands with the merge: the line is after it. */
    readonly going: boolean;
    /** Dimmed: below the line. */
    readonly dimmed: boolean;
}

/** Places the copy does not hold a pull request for yet, in a row (D7, SP50). */
export interface StackMergeMissingRow {
    readonly kind: 'missing';
    readonly count: number;
}

/**
 * What a row says of its pull request: its own state as its pip shows it; staying open below the line (SP41); held
 * by an earlier one — blocked, or green itself (SP45, SP48); its checks running again after earlier ones landed (SP58);
 * being merged (SP56).
 */
export type StackMergeRowState =
    | { readonly kind: 'own'; readonly pip: StackPullRequestPipKind }
    | { readonly kind: 'staysOpen' }
    | { readonly kind: 'blocked' }
    | { readonly kind: 'heldBy'; readonly number: number }
    | { readonly kind: 'freshChecks' }
    | { readonly kind: 'merging' };

/** A stack's merge as the merge panel shows it (stacked PRs D11). */
export interface StackMergeView {
    /** The stack as the entry reads it: its name (D4) for the header, how many landed and how many the copy holds. */
    readonly description: StackDescription;
    readonly merge: StackMerge;
    /** The checks of {@link StackMerge.checksOf}, for two or more going; `null` otherwise. */
    readonly checks: StackMergeChecks | null;
}

/** One member's checks in a stack's merge panel: the checks of a range are those of whoever it comes down to. */
export interface StackMergeChecks {
    /** The pull request's number: the panel says whose they are. */
    readonly number: number;
    /** The row's summary of them, until the read arrives. */
    readonly summary: ItemChecks | null;
    /** As read for the panel; `null` until they arrive, or when they could not be read. */
    readonly checks: readonly MergeCheck[] | null;
    readonly reading: boolean;
}
