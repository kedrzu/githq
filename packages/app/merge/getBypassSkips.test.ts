/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { samplePullRequest } from '@/testing/sampleItems.js';
import { sampleMergeCheck } from '@/testing/sampleMergeChecks.js';

import { getBypassSkips } from './getBypassSkips.js';

const PR = samplePullRequest('PR_1');

test('every requirement not met: required checks failing and running by name, the review, behind (PM12a)', () => {
    const checks = [
        sampleMergeCheck('ci / test', { isRequired: true, state: 'failing' }),
        sampleMergeCheck('deploy', { isRequired: true, state: 'pending' }),
        sampleMergeCheck('ci / lint', { isRequired: true }),
        sampleMergeCheck('CodeQL', { state: 'failing' }),
    ];

    const held = checks.slice(0, 2);
    expect(getBypassSkips({ ...PR, reviewDecision: 'REVIEW_REQUIRED', mergeStateStatus: 'BEHIND' }, checks)).toEqual({
        checks: held,
        review: 'required',
        behind: true,
        other: false,
    });
});

test('changes requested are told from a review still missing', () => {
    expect(getBypassSkips({ ...PR, reviewDecision: 'CHANGES_REQUESTED' }, []).review).toBe('changesRequested');
});

test('blocked for what nothing read names: it says so, and only then', () => {
    expect(getBypassSkips({ ...PR, reviewDecision: 'APPROVED', mergeStateStatus: 'BLOCKED' }, []).other).toBe(true);
    expect(getBypassSkips({ ...PR, reviewDecision: 'REVIEW_REQUIRED', mergeStateStatus: 'BLOCKED' }, []).other).toBe(
        false,
    );
});
