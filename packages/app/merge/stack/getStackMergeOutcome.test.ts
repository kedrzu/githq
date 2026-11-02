/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { PullRequestItem } from '@/store/ItemTypes.js';
import { sampleStack } from '@/testing/sampleStacks.js';

import { getStackMergeOutcome } from './getStackMergeOutcome.js';
import type { StackMergeRecord } from './StackMergeTypes.js';

const MEMBERS = sampleStack({ id: 'S_1', number: 1, members: [{}, {}, {}] });
const REASON = { kind: 'refused', message: 'Required status check "e2e" is failing.' } as const;

test('refused partway, nothing is known of any pull request until the stack is read again (SP60)', () => {
    const record = refused({ partway: true, read: false });
    expect(getStackMergeOutcome({ record, members: MEMBERS })).toEqual({ kind: 'reading', reason: REASON });
});

test('read again: what landed and where it stopped, never all or none by assumption (SP59)', () => {
    const members = withState(MEMBERS, 0, { state: 'MERGED', merged: true });
    const outcome = getStackMergeOutcome({ record: refused({ partway: true, read: true }), members });
    expect(outcome).toMatchObject({ kind: 'stopped', at: { number: 2 }, landed: 1, reason: REASON });
});

test('read again with nothing landed: refused, nothing merged (SP61); everything landed: nothing to say', () => {
    expect(getStackMergeOutcome({ record: refused({ partway: true, read: true }), members: MEMBERS })).toEqual({
        kind: 'refused',
        reason: REASON,
    });
    const merged = MEMBERS.map(pr => ({ ...pr, state: 'MERGED', merged: true }) as const);
    expect(getStackMergeOutcome({ record: refused({ partway: true, read: true }), members: merged })).toBeNull();
});

test('a head moved on any pull request going: nothing merged, and which one has the new commit (SP62)', () => {
    const members = withState(MEMBERS, 1, { headRefOid: 'pushed' });
    expect(getStackMergeOutcome({ record: refused({ partway: false, read: false }), members })).toMatchObject({
        kind: 'headMoved',
        pullRequest: { number: 2, headRefOid: 'pushed' },
    });
});

test('no answer in time stays not known (PM29)', () => {
    const record: StackMergeRecord = { kind: 'unknown', sent: sent(), accepted: true };
    expect(getStackMergeOutcome({ record, members: MEMBERS })).toEqual({ kind: 'unknown', accepted: true });
    expect(getStackMergeOutcome({ record: null, members: MEMBERS })).toBeNull();
});

function refused(params: { partway: boolean; read: boolean }): StackMergeRecord {
    return { kind: 'refused', sent: sent(), reason: REASON, ...params };
}

function sent() {
    return {
        method: 'SQUASH' as const,
        going: MEMBERS.map(pr => ({ itemId: pr.id, number: pr.number, head: pr.headRefOid })),
    };
}

function withState(members: readonly PullRequestItem[], index: number, change: Partial<PullRequestItem>) {
    return members.map((pr, at) => (at === index ? { ...pr, ...change } : pr));
}
