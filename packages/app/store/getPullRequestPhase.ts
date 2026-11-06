import { getPullRequestStanding } from '@/store/getPullRequestStanding.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';

/**
 * Which branch a pull request's row status takes — the one decision behind both its status line and its "Status"
 * group, so the two cannot disagree.
 */
export type PullRequestPhase =
    | 'merged'
    | 'closed'
    | 'beingMerged'
    | 'inQueue'
    | 'autoMerge'
    | 'needsAuthor'
    | 'checksRunning'
    | 'approvedReady'
    | 'readyWithoutReview'
    | 'approved'
    | 'reviewRequested'
    | 'draft'
    | 'waitingForReview'
    | 'none';

/** The stage a pull request is grouped by: its phases, coarser. */
export type PullRequestStage = (typeof PULL_REQUEST_STAGES)[number];

/** The stages in the order their groups are shown. */
export const PULL_REQUEST_STAGES = [
    'draft',
    'waitingForReview',
    'needsWork',
    'checksRunning',
    'readyToMerge',
    'merging',
    'merged',
    'closed',
] as const;

/** The stage of each phase: every pull request — open, merged or closed — has one. */
export const PULL_REQUEST_STAGE_OF: Readonly<Record<PullRequestPhase, PullRequestStage>> = {
    merged: 'merged',
    closed: 'closed',
    beingMerged: 'merging',
    inQueue: 'merging',
    autoMerge: 'merging',
    needsAuthor: 'needsWork',
    checksRunning: 'checksRunning',
    approvedReady: 'readyToMerge',
    readyWithoutReview: 'readyToMerge',
    approved: 'readyToMerge',
    reviewRequested: 'waitingForReview',
    draft: 'draft',
    waitingForReview: 'waitingForReview',
    none: 'waitingForReview',
};

/** How the pull request is listed. */
export interface GetPullRequestPhaseOptions {
    /** It is listed because the viewer's review is asked: with nothing else to say, its row says so. */
    readonly reviewRequested: boolean;
}

/**
 * The phase of a pull request, in the precedence its row status follows. The session's own record of a merge that
 * did not end merged (D15) is not a phase: the row lays it over the phase itself.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getPullRequestPhase(pr: PullRequestItem, options: GetPullRequestPhaseOptions): PullRequestPhase {
    if (pr.merged) {
        return 'merged';
    }

    if (pr.state !== 'OPEN') {
        return 'closed';
    }

    // Merged once GitHub says so (merging D3): until then it stays open, being merged.
    if (pr.merging) {
        return 'beingMerged';
    }

    if (pr.mergeQueueEntry) {
        return 'inQueue';
    }

    if (pr.autoMerge) {
        return 'autoMerge';
    }

    const standing = getPullRequestStanding(pr);
    if (standing.needsAuthor) {
        return 'needsAuthor';
    }

    if (standing.checksRunning) {
        return 'checksRunning';
    }

    if (standing.readyToMerge) {
        return 'approvedReady';
    }

    // A review asked with no decision required stays "waiting for review", although GitHub would merge it.
    if (standing.mergesWithoutReview && !standing.waitingForReview && !options.reviewRequested) {
        return 'readyWithoutReview';
    }

    if (standing.approved) {
        return 'approved';
    }

    if (options.reviewRequested) {
        return 'reviewRequested';
    }

    if (pr.isDraft) {
        return 'draft';
    }

    if (standing.waitingForReview) {
        return 'waitingForReview';
    }

    return 'none';
}
