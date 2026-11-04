/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { ItemChecks, PullRequestStatus } from '@/store/ItemTypes.js';
import { samplePullRequest } from '@/testing/sampleItems.js';

import { getPullRequestStanding } from './getPullRequestStanding.js';

const PASSED: ItemChecks = { state: 'SUCCESS', passing: 3, failing: 0, pending: 0 };

const CHECKS_PASSED: readonly (readonly [string, ItemChecks | null, boolean])[] = [
    ['all succeeded', PASSED, true],
    ['nothing runs on the head commit', null, false],
    ['failed', { state: 'FAILURE', passing: 2, failing: 1, pending: 0 }, false],
    ['errored without a count', { state: 'ERROR', passing: 3, failing: 0, pending: 0 }, false],
    ['running', { state: 'PENDING', passing: 2, failing: 0, pending: 1 }, false],
    ['expected and not reported yet', { state: 'EXPECTED', passing: 3, failing: 0, pending: 0 }, false],
    ['success with one still pending', { ...PASSED, pending: 1 }, false],
    ['success with one failing', { ...PASSED, failing: 1 }, false],
];

test.each(CHECKS_PASSED)('checksPassed: %s', (_case, checks, expected) => {
    expect(getPullRequestStanding(status({ checks })).checksPassed).toBe(expected);
});

const MERGES_WITHOUT_REVIEW: readonly (readonly [string, Partial<PullRequestStatus>, boolean])[] = [
    ['clean, no checks at all', {}, true],
    ['with hooks', { mergeStateStatus: 'HAS_HOOKS' }, true],
    ['checks not required still running', { checks: { ...PASSED, state: 'PENDING', pending: 1 } }, true],
    ['GitHub holds it', { mergeStateStatus: 'BLOCKED' }, false],
    ['behind its base', { mergeStateStatus: 'BEHIND' }, false],
    ['a check not required fails', { mergeStateStatus: 'UNSTABLE' }, false],
    ['draft', { isDraft: true }, false],
    ['approved', { reviewDecision: 'APPROVED' }, false],
    ['review required', { reviewDecision: 'REVIEW_REQUIRED' }, false],
    ['the rollup fails', { checks: { ...PASSED, state: 'FAILURE', failing: 1 } }, false],
    ['conflicting while the status is stale', { mergeable: 'CONFLICTING' }, false],
];

test.each(MERGES_WITHOUT_REVIEW)('mergesWithoutReview: %s', (_case, changes, expected) => {
    expect(getPullRequestStanding(status(changes)).mergesWithoutReview).toBe(expected);
});

/** An open pull request GitHub would merge, with no review decision, but for the changes. */
function status(changes: Partial<PullRequestStatus>): PullRequestStatus {
    return { ...samplePullRequest('PR_1'), ...changes };
}
