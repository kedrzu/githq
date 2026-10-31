import type { PullRequestStatus } from '@/store/ItemTypes.js';

/**
 * Where an open pull request stands, read from its status summary (D11, D18) — what the "my work" filters
 * sort it by and what its row says.
 */
export interface PullRequestStanding {
    /** How many checks fail; `0` with {@link checksFailing} when the rollup fails without a count. */
    readonly failingChecks: number;
    /** The check rollup fails or errors. */
    readonly checksFailing: boolean;
    /** Checks are still running and none fails. */
    readonly checksRunning: boolean;
    readonly changesRequested: boolean;
    /** It cannot be merged without resolving conflicts. */
    readonly conflicts: boolean;
    readonly approved: boolean;
    /** Approved, not a draft, and GitHub says it can be merged now. */
    readonly readyToMerge: boolean;
    /** Not a draft, and a review is still required, or asked of someone with no decision yet. */
    readonly waitingForReview: boolean;
    /** Its author has something to do: failing checks, changes requested, or conflicts. */
    readonly needsAuthor: boolean;
    /**
     * Its author waits for others: for a review or for checks to finish (D11) — whether or not they also have
     * something to do ({@link needsAuthor}); "Needs me" and "Waiting on others" may both list it.
     */
    readonly waitingOnOthers: boolean;
}

/**
 * Where a pull request stands.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getPullRequestStanding(pr: PullRequestStatus): PullRequestStanding {
    const { checks } = pr;
    const failingChecks = checks?.failing ?? 0;
    const checksFailing = failingChecks > 0 || checks?.state === 'FAILURE' || checks?.state === 'ERROR';
    const checksRunning =
        !checksFailing &&
        checks !== null &&
        (checks.pending > 0 || checks.state === 'PENDING' || checks.state === 'EXPECTED');
    const changesRequested = pr.reviewDecision === 'CHANGES_REQUESTED';
    const conflicts = pr.mergeable === 'CONFLICTING' || pr.mergeStateStatus === 'DIRTY';
    const approved = pr.reviewDecision === 'APPROVED';
    const readyToMerge =
        approved && !pr.isDraft && (pr.mergeStateStatus === 'CLEAN' || pr.mergeStateStatus === 'HAS_HOOKS');
    const waitingForReview =
        !pr.isDraft &&
        (pr.reviewDecision === 'REVIEW_REQUIRED' || (pr.reviewDecision === null && pr.reviewRequests.length > 0));
    const needsAuthor = checksFailing || changesRequested || conflicts;

    return {
        failingChecks,
        checksFailing,
        checksRunning,
        changesRequested,
        conflicts,
        approved,
        readyToMerge,
        waitingForReview,
        needsAuthor,
        waitingOnOthers: waitingForReview || checksRunning,
    };
}
