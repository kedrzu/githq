/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type {
    ItemChecks,
    ItemReviewRequest,
    PullRequestAutoMerge,
    PullRequestItem,
    PullRequestQueueEntry,
} from '@/store/ItemTypes.js';
import { samplePullRequest } from '@/testing/sampleItems.js';

import { getPullRequestPhase, PULL_REQUEST_STAGE_OF, PULL_REQUEST_STAGES } from './getPullRequestPhase.js';
import type { PullRequestPhase } from './getPullRequestPhase.js';

const PASSED: ItemChecks = { state: 'SUCCESS', passing: 3, failing: 0, pending: 0 };
const FAILING: ItemChecks = { state: 'FAILURE', passing: 2, failing: 1, pending: 0 };
const RUNNING: ItemChecks = { state: 'PENDING', passing: 2, failing: 0, pending: 1 };
const REVIEWER: ItemReviewRequest = { kind: 'user', login: 'hubot' };
const QUEUE_ENTRY: PullRequestQueueEntry = {
    position: 1,
    state: 'QUEUED',
    estimatedTimeToMerge: null,
    enqueuedAt: '2026-10-20T10:00:00Z',
    enqueuer: 'octocat',
};
const AUTO_MERGE: PullRequestAutoMerge = {
    mergeMethod: 'SQUASH',
    enabledAt: null,
    enabledBy: null,
    commitHeadline: null,
};

const PHASES: readonly (readonly [string, Partial<PullRequestItem>, boolean, PullRequestPhase])[] = [
    ['merged', { merged: true, state: 'MERGED' }, false, 'merged'],
    [
        'merged, with a merge still marked on its way',
        { merged: true, state: 'MERGED', merging: 'SQUASH' },
        false,
        'merged',
    ],
    ['closed', { state: 'CLOSED' }, false, 'closed'],
    ['closed with failing checks', { state: 'CLOSED', checks: FAILING }, false, 'closed'],
    ['being merged', { merging: 'MERGE', mergeQueueEntry: QUEUE_ENTRY }, false, 'beingMerged'],
    ['in the merge queue', { mergeQueueEntry: QUEUE_ENTRY, autoMerge: AUTO_MERGE }, false, 'inQueue'],
    ['auto-merge on with failing checks', { autoMerge: AUTO_MERGE, checks: FAILING }, false, 'autoMerge'],
    ['failing checks', { checks: FAILING }, false, 'needsAuthor'],
    ['changes requested', { reviewDecision: 'CHANGES_REQUESTED' }, false, 'needsAuthor'],
    ['conflicts', { mergeable: 'CONFLICTING' }, false, 'needsAuthor'],
    ['a draft with failing checks', { isDraft: true, checks: FAILING }, false, 'needsAuthor'],
    ['checks running', { checks: RUNNING, reviewDecision: 'APPROVED' }, false, 'checksRunning'],
    ['approved and clean', { reviewDecision: 'APPROVED', checks: PASSED }, false, 'approvedReady'],
    ['approved and clean, review asked of the viewer', { reviewDecision: 'APPROVED' }, true, 'approvedReady'],
    ['mergeable without a review', { checks: PASSED }, false, 'readyWithoutReview'],
    ['mergeable without a review, reviews asked', { reviewRequests: [REVIEWER] }, false, 'waitingForReview'],
    ["mergeable without a review, the viewer's review asked", {}, true, 'reviewRequested'],
    ['approved, GitHub holds it', { reviewDecision: 'APPROVED', mergeStateStatus: 'BLOCKED' }, false, 'approved'],
    ['an approved draft', { isDraft: true, reviewDecision: 'APPROVED' }, false, 'approved'],
    ["review required, the viewer's asked", { reviewDecision: 'REVIEW_REQUIRED' }, true, 'reviewRequested'],
    ['a draft', { isDraft: true }, false, 'draft'],
    ["a draft, the viewer's review asked", { isDraft: true }, true, 'reviewRequested'],
    ['review required', { reviewDecision: 'REVIEW_REQUIRED', mergeStateStatus: 'BLOCKED' }, false, 'waitingForReview'],
    ['nothing to say', { mergeStateStatus: 'BLOCKED' }, false, 'none'],
];

test.each(PHASES)('phase: %s', (_case, changes, reviewRequested, expected) => {
    expect(getPullRequestPhase({ ...samplePullRequest('PR_1'), ...changes }, { reviewRequested })).toBe(expected);
});

test('every stage is reached by a phase', () => {
    expect(new Set(Object.values(PULL_REQUEST_STAGE_OF))).toEqual(new Set(PULL_REQUEST_STAGES));
});
