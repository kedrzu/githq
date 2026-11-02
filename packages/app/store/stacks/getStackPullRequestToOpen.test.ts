/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { PullRequestItem } from '@/store/ItemTypes.js';
import { samplePullRequest } from '@/testing/sampleItems.js';

import { getStackPullRequestToOpen } from './getStackPullRequestToOpen.js';

const merged = pr('PR_merged', { state: 'MERGED', merged: true });
const approved = pr('PR_approved', { reviewDecision: 'APPROVED' });
const unreviewed = pr('PR_unreviewed', { reviewDecision: 'REVIEW_REQUIRED' });
const closed = pr('PR_closed', { state: 'CLOSED' });

test('opens the first open pull request not yet approved', () => {
    expect(getStackPullRequestToOpen([merged, approved, unreviewed, pr('PR_later')])?.id).toBe('PR_unreviewed');
});

test('opens the first open one when every open one is approved', () => {
    expect(getStackPullRequestToOpen([merged, approved, pr('PR_also', { reviewDecision: 'APPROVED' })])?.id).toBe(
        'PR_approved',
    );
});

test('opens the last one when none is open', () => {
    expect(getStackPullRequestToOpen([merged, closed])?.id).toBe('PR_closed');
});

function pr(id: string, overrides: Partial<PullRequestItem> = {}): PullRequestItem {
    return { ...samplePullRequest(id), ...overrides };
}
