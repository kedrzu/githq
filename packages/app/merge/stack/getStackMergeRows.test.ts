/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { PullRequestItem } from '@/store/ItemTypes.js';
import { sampleStack, sampleStackDescription } from '@/testing/sampleStacks.js';

import { getStackMerge } from './getStackMerge.js';
import { getStackMergeRows } from './getStackMergeRows.js';
import type { StackMergeRow } from './StackMergeTypes.js';

const BLOCKED = { mergeStateStatus: 'BLOCKED', reviewDecision: 'REVIEW_REQUIRED' } as const;

test('those going before the line, later ones dimmed and staying open (SP41)', () => {
    const rows = rowsOf([{}, {}, {}, {}], { end: 2 });
    expect(summary(rows)).toEqual([
        '1 going own:ready',
        '2 going own:ready',
        '3 dimmed staysOpen',
        '4 dimmed staysOpen',
    ]);
});

test('SP54: in the queue each row says its entry, and none is marked as going', () => {
    const entry = {
        position: 2,
        state: 'QUEUED',
        estimatedTimeToMerge: null,
        enqueuedAt: '',
        enqueuer: 'a',
    } as const;
    const members = sampleStack({
        id: 'S_q',
        number: 1,
        members: [{ mergeQueueEntry: entry }, { mergeQueueEntry: entry }],
    });
    const description = sampleStackDescription(members);
    const queued = getStackMergeRows({ merge: getStackMerge({ description, end: null }) });
    expect(queued.map(row => (row.kind === 'pullRequest' ? [row.state.kind, row.going] : null))).toEqual([
        ['queued', false],
        ['queued', false],
    ]);
});

test('held: the one holding says its own state, those after it are blocked or green and held (SP45)', () => {
    const rows = rowsOf([{}, {}, BLOCKED, {}, BLOCKED], { end: 2 });
    expect(summary(rows)).toEqual([
        '1 going own:ready',
        '2 going own:ready',
        '3 dimmed own:waiting',
        '4 dimmed heldBy:3',
        '5 dimmed blocked',
    ]);
});

test('partly merged: those left whose checks run again read so, also past the first of them (SP58)', () => {
    const running = {
        mergeStateStatus: 'BLOCKED',
        checks: { state: 'PENDING', passing: 1, failing: 0, pending: 1 },
    } as const;
    const rows = rowsOf([{ state: 'MERGED', merged: true }, running, running, {}], { end: null });
    expect(summary(rows)).toEqual(['1 own:merged', '2 going freshChecks', '3 going freshChecks', '4 going heldBy:2']);
});

test('being merged: every one going reads so (SP56)', () => {
    const members = sampleStack({ id: 'S_1', number: 1, members: [{}, {}] }).map(pr => ({
        ...pr,
        merging: 'SQUASH' as const,
    }));
    const merge = getStackMerge({ description: sampleStackDescription(members), end: null });
    expect(summary(getStackMergeRows({ merge }))).toEqual(['1 going merging', '2 going merging']);
});

test('places the copy does not hold yet fold into one row (SP50)', () => {
    const members = sampleStack({ id: 'S_1', number: 1, members: [{}, {}], size: 4 });
    const merge = getStackMerge({ description: sampleStackDescription(members), end: null });
    const rows = getStackMergeRows({ merge });
    expect(rows.at(-1)).toEqual({ kind: 'missing', count: 2 });
    expect(rows).toHaveLength(3);
});

test('the outcome not known: each says its own state as the copy has it, none going, none dimmed (D11, PM29)', () => {
    const stack = sampleStack({ id: 'S_1', number: 1, members: [{ state: 'MERGED', merged: true }, {}, {}] });
    const merge = getStackMerge({ description: sampleStackDescription(stack), end: 2 });
    expect(summary(getStackMergeRows({ merge, outcomeUnknown: true }))).toEqual([
        '1 own:merged',
        '2 own:ready',
        '3 own:ready',
    ]);
});

test('after a merge that stopped partway: the one that landed reads merged, those left as any range (SP59)', () => {
    const stack = sampleStack({ id: 'S_1', number: 1, members: [{ state: 'MERGED', merged: true }, {}, {}] });
    const merge = getStackMerge({ description: sampleStackDescription(stack), end: null });
    expect(summary(getStackMergeRows({ merge }))).toEqual(['1 own:merged', '2 going own:ready', '3 going own:ready']);
});

test('nothing marked as landing while the whole range is blocked (SP46)', () => {
    const rows = rowsOf([{}, { behindBase: true }], { end: null });
    expect(summary(rows)).toEqual(['1 own:moving', '2 own:moving']);
});

function rowsOf(members: readonly Partial<PullRequestItem>[], params: { end: number | null }): StackMergeRow[] {
    const description = sampleStackDescription(sampleStack({ id: 'S_1', number: 1, members }));
    return getStackMergeRows({ merge: getStackMerge({ description, end: params.end }) });
}

function summary(rows: readonly StackMergeRow[]): string[] {
    return rows.map(row => {
        if (row.kind === 'missing') {
            return `missing ${row.count}`;
        }

        const { state } = row;
        let said: string = state.kind;
        if (state.kind === 'own') {
            said = `own:${state.pip}`;
        } else if (state.kind === 'heldBy') {
            said = `heldBy:${state.number}`;
        }

        return [row.pullRequest.number, row.going ? 'going' : null, row.dimmed ? 'dimmed' : null, said]
            .filter(part => part !== null)
            .join(' ');
    });
}
