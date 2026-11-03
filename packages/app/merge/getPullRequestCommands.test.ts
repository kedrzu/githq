import { expect, test } from 'bun:test';

import { getEditPermissions } from '@/edits/getEditPermissions.js';
import type { Item, PullRequestItem } from '@/store/ItemTypes.js';
import { samplePullRequest } from '@/testing/sampleItems.js';

import { getPullRequestCommands } from './getPullRequestCommands.js';

function kinds(pr: PullRequestItem, permission: 'READ' | 'WRITE' = 'WRITE', items: readonly Item[] = []) {
    const permissions = getEditPermissions({ item: pr, viewerLogin: 'someone-else', permission });
    return getPullRequestCommands({ pr, permissions, items, outcomeUnknown: false }).map(command =>
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
});

test("in a stack it updates only from the first still open, as GitHub doesn't renumber them once one landed", () => {
    const at = (position: number): PullRequestItem => ({
        ...OPEN,
        id: `PR_${position}`,
        behindBase: true,
        stack: { id: 'S_1', number: 1, size: 3, position },
    });
    const landed: PullRequestItem = { ...at(1), state: 'MERGED', merged: true };

    // A later one, behind its base, needs GitHub's "Rebase stack".
    expect(kinds(at(2), 'WRITE', [at(1), at(2), at(3)])).toEqual([]);
    expect(kinds(at(1), 'WRITE', [at(1), at(2), at(3)])).toEqual(['updateBranch:MERGE', 'updateBranch:REBASE']);
    expect(kinds(at(2), 'WRITE', [landed, at(2), at(3)])).toEqual(['updateBranch:MERGE', 'updateBranch:REBASE']);
    expect(kinds(at(3), 'WRITE', [landed, at(2), at(3)])).toEqual([]);
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

test('PM29: a merge with no known end yet offers no update: it may still land', () => {
    const pr: PullRequestItem = { ...samplePullRequest('PR_1'), mergeStateStatus: 'BEHIND' };

    expect(
        getPullRequestCommands({
            pr,
            permissions: getEditPermissions({ item: pr, viewerLogin: 'someone-else', permission: 'WRITE' }),
            items: [pr],
            outcomeUnknown: true,
        }).filter(command => command.kind === 'updateBranch'),
    ).toEqual([]);
});
