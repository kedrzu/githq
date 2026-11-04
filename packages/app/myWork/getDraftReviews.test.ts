import { expect, test } from 'bun:test';

import { sampleIssue, samplePullRequest } from '@/testing/sampleItems.js';

import { getDraftReviews } from './getDraftReviews.js';

test('the pull requests with a draft review, the one waiting longest first, a merged one too; nothing else', () => {
    const newer = withDraft('PR_1', '2026-11-03T10:00:00Z');
    const older = { ...withDraft('PR_2', '2026-11-01T10:00:00Z'), state: 'MERGED' as const, merged: true };

    const found = getDraftReviews([sampleIssue('I_1'), samplePullRequest('PR_3'), newer, older]);

    expect(found.map(item => item.id)).toEqual(['PR_2', 'PR_1']);
});

function withDraft(id: string, createdAt: string) {
    return { ...samplePullRequest(id), pendingReview: { id: `PRR_${id}`, commentCount: 1, createdAt } };
}
