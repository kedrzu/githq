import { expect, test } from 'bun:test';

import { getEditPermissions } from '@/edits/getEditPermissions.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import { samplePullRequest } from '@/testing/sampleItems.js';

import { getPullRequestCommands } from './getPullRequestCommands.js';

function kinds(pr: PullRequestItem, permission: 'READ' | 'WRITE' = 'WRITE') {
    const permissions = getEditPermissions({ item: pr, viewerLogin: 'someone-else', permission });
    return getPullRequestCommands(pr, permissions).map(command =>
        command.kind === 'updateBranch' ? `updateBranch:${command.method}` : command.kind,
    );
}

const OPEN = samplePullRequest('PR_1');
const MERGED: PullRequestItem = {
    ...OPEN,
    state: 'MERGED',
    merged: true,
    headRefId: 'REF_1',
    viewerCanDeleteHeadRef: true,
};
const QUEUE_ENTRY: PullRequestItem['mergeQueueEntry'] = {
    position: 1,
    state: 'QUEUED',
    estimatedTimeToMerge: null,
    enqueuedAt: '2026-11-03T10:00:00Z',
    enqueuer: 'someone-else',
};

test('an open pull request with nothing behind or failing takes none of them', () => {
    expect(kinds(OPEN)).toEqual([]);
});

test('a branch behind updates by merge or by rebase', () => {
    const behind: PullRequestItem = { ...OPEN, mergeStateStatus: 'BEHIND' };

    expect(kinds(behind)).toEqual(['updateBranch:MERGE', 'updateBranch:REBASE']);
    expect(kinds({ ...OPEN, behindBase: true })).toEqual(['updateBranch:MERGE', 'updateBranch:REBASE']);
    expect(kinds(behind, 'READ')).toEqual([]);
});

test("a branch behind that can't be updated from here isn't offered it", () => {
    const behind: PullRequestItem = { ...OPEN, behindBase: true };

    expect(kinds({ ...behind, mergeable: 'CONFLICTING' })).toEqual([]);
    expect(kinds({ ...behind, merging: 'SQUASH' })).toEqual([]);
    expect(kinds({ ...behind, mergeQueueEntry: QUEUE_ENTRY })).toEqual(['dequeue']);
    // A later one of a stack, behind its base, needs GitHub's "Rebase stack".
    expect(kinds({ ...behind, stack: { id: 'S_1', number: 1, size: 2, position: 2 } })).toEqual([]);
    expect(kinds({ ...behind, stack: { id: 'S_1', number: 1, size: 2, position: 1 } })).toEqual([
        'updateBranch:MERGE',
        'updateBranch:REBASE',
    ]);
});

test('failed checks re-run for someone who can push, while it is open', () => {
    const failing: PullRequestItem = { ...OPEN, checks: { state: 'FAILURE', passing: 1, failing: 1, pending: 0 } };

    expect(kinds(failing)).toEqual(['rerunFailedChecks']);
    expect(kinds(failing, 'READ')).toEqual([]);
    expect(kinds({ ...failing, ...MERGED, checks: failing.checks })).not.toContain('rerunFailedChecks');
});

test('merged, its branch deletes only where GitHub says the viewer can, and it reverts', () => {
    expect(kinds(MERGED)).toEqual(['deleteBranch', 'revert']);
    expect(kinds({ ...MERGED, viewerCanDeleteHeadRef: false })).toEqual(['revert']);
    expect(kinds(MERGED, 'READ')).toEqual(['deleteBranch']);
});

test('its branch never deletes while it is open, which would close it', () => {
    expect(kinds({ ...OPEN, headRefId: 'REF_1', viewerCanDeleteHeadRef: true })).toEqual([]);
});

test('its deleted branch restores in its own repository alone', () => {
    const deleted: PullRequestItem = { ...MERGED, headRefId: null, viewerCanDeleteHeadRef: false };

    expect(kinds(deleted)).toEqual(['restoreBranch', 'revert']);
    expect(kinds({ ...deleted, isCrossRepository: true })).toEqual(['revert']);
    expect(kinds({ ...deleted, headRepositoryId: null })).toEqual(['revert']);
    expect(kinds(deleted, 'READ')).toEqual([]);
});

test('closed unmerged, the branch still deletes and restores, and nothing reverts', () => {
    const closed: PullRequestItem = { ...OPEN, state: 'CLOSED', headRefId: 'REF_1', viewerCanDeleteHeadRef: true };

    expect(kinds(closed)).toEqual(['deleteBranch']);
    expect(kinds({ ...closed, headRefId: null, viewerCanDeleteHeadRef: false })).toEqual(['restoreBranch']);
});

test('queued, it takes out of the queue for someone who may merge', () => {
    const queued: PullRequestItem = { ...OPEN, mergeQueueEntry: QUEUE_ENTRY };

    expect(kinds(queued)).toEqual(['dequeue']);
    expect(kinds(queued, 'READ')).toEqual([]);
});
