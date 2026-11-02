import type { PullRequestMergeMethod } from '@githq/github/generated.gen.js';

import type { EditFailureReason } from '@/edits/EditTypes.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import type { StackBlocker, StackPip, StackPullRequestPipKind } from '@/store/stacks/describeStack.js';

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

/** A stack's merge of two or more this session sent (stacked PRs D11): one merge of the top, landing every one going. */
export interface SentStackMerge {
    readonly method: PullRequestMergeMethod;
    /** Every pull request going, first to last — the top last — with the head commit each had as it was sent. */
    readonly going: readonly StackMergeHead[];
}

/** A pull request going with a stack's merge, and the head commit it had as the merge was sent. */
export interface StackMergeHead {
    readonly itemId: string;
    readonly number: number;
    readonly head: string;
}

/**
 * What this session knows of a stack's last merge of two or more that did not end merged, as GitHub answered it
 * (merging D3, D15): refused — at once, so nothing landed (SP61), or while it ran, so some may have (SP59) — or no
 * answer in time (PM29). How it reads is told from the stack as it is then ({@link StackMergeOutcome}).
 */
export type StackMergeRecord =
    | StackMergeRefusal
    | {
          readonly kind: 'unknown';
          readonly sent: SentStackMerge;
          /** GitHub accepted it and said no result in time; `false`: the request itself went unanswered. */
          readonly accepted: boolean;
      };

/** A stack's merge GitHub refused, as {@link StackMergeRecord} keeps it. */
export interface StackMergeRefusal {
    readonly kind: 'refused';
    readonly sent: SentStackMerge;
    readonly reason: EditFailureReason;
    /** GitHub refused it after taking it: earlier ones may have landed. */
    readonly partway: boolean;
    /**
     * The stack was read again since the refusal (stacked PRs D11): what the copy holds is what landed. Until then
     * nothing is known of a partway one (SP60).
     */
    readonly read: boolean;
}

/**
 * How a stack's last merge that did not end merged reads now (`getStackMergeOutcome`): refused partway and not read
 * again yet (SP60); a pull request going has a new commit since — nothing merged, deliberately (SP62); stopped at a
 * pull request after some landed (SP59); refused with nothing landed (SP61); or no answer (PM29).
 */
export type StackMergeOutcome =
    | { readonly kind: 'reading'; readonly reason: EditFailureReason }
    | {
          readonly kind: 'headMoved';
          /** The first pull request going whose head moved since the merge was sent. */
          readonly pullRequest: PullRequestItem;
      }
    | {
          readonly kind: 'stopped';
          /** The first pull request going that did not land. */
          readonly at: PullRequestItem;
          /** How many of those going landed. */
          readonly landed: number;
          readonly reason: EditFailureReason;
      }
    | { readonly kind: 'refused'; readonly reason: EditFailureReason }
    | { readonly kind: 'unknown'; readonly accepted: boolean };

/** A row of a stack's merge panel, first to last (SP40–SP62). */
export type StackMergeRow = StackMergePullRequestRow | StackMergeMissingRow;

/** A pull request of the stack in the panel's list. */
export interface StackMergePullRequestRow {
    readonly kind: 'pullRequest';
    readonly pullRequest: PullRequestItem;
    readonly state: StackMergeRowState;
    /** It lands with the merge: the line is after it. */
    readonly going: boolean;
    /** Dimmed: below the line, or past where a merge that did not end merged stopped. */
    readonly dimmed: boolean;
}

/** Places the copy does not hold a pull request for yet, in a row (D7, SP50). */
export interface StackMergeMissingRow {
    readonly kind: 'missing';
    readonly count: number;
}

/**
 * What a row says of its pull request: its own state as its pip shows it; staying open below the line (SP41); held
 * by an earlier one — blocked, or green itself (SP45, SP48); being merged (SP56); not known yet (SP60); refused where
 * a merge stopped, still open after it (SP59); not merged, or the one with a new commit (SP62).
 */
export type StackMergeRowState =
    | { readonly kind: 'own'; readonly pip: StackPullRequestPipKind }
    | { readonly kind: 'staysOpen' }
    | { readonly kind: 'blocked' }
    | { readonly kind: 'heldBy'; readonly number: number }
    | { readonly kind: 'merging' }
    | { readonly kind: 'notKnown' }
    | { readonly kind: 'refused' }
    | { readonly kind: 'stillOpen' }
    | { readonly kind: 'notMerged' }
    | { readonly kind: 'newCommit' };

/** A stack's merge as the merge panel shows it (stacked PRs D11). */
export interface StackMergeView {
    /** The stack's name (D4): its header's title. */
    readonly name: string;
    readonly merge: StackMerge;
    /** How its last merge of two or more that did not end merged reads; `null` for none. */
    readonly outcome: StackMergeOutcome | null;
}
