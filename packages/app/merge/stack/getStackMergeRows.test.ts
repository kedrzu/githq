/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { PullRequestItem } from '@/store/ItemTypes.js';
import { sampleStack, sampleStackDescription } from '@/testing/sampleStacks.js';

import { getStackMerge } from './getStackMerge.js';
import { getStackMergeRows } from './getStackMergeRows.js';
import type { StackMergeOutcome, StackMergeRow } from './StackMergeTypes.js';

const BLOCKED = { mergeStateStatus: 'BLOCKED', reviewDecision: 'REVIEW_REQUIRED' } as const;
const REASON = { kind: 'refused', message: 'Refused' } as const;

test('those going before the line, later ones dimmed and staying open (SP41)', () => {
    const rows = rowsOf([{}, {}, {}, {}], { end: 2 });
    expect(summary(rows)).toEqual([
        '1 going own:ready',
        '2 going own:ready',
        '3 dimmed staysOpen',
        '4 dimmed staysOpen',
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

test('being merged: every one going reads so (SP56)', () => {
    const members = sampleStack({ id: 'S_1', number: 1, members: [{}, {}] }).map(pr => ({
        ...pr,
        merging: 'SQUASH' as const,
    }));
    const merge = getStackMerge({ description: sampleStackDescription(members), end: null });
    expect(summary(getStackMergeRows({ merge, outcome: null }))).toEqual(['1 going merging', '2 going merging']);
});

test('places the copy does not hold yet fold into one row (SP50)', () => {
    const members = sampleStack({ id: 'S_1', number: 1, members: [{}, {}], size: 4 });
    const merge = getStackMerge({ description: sampleStackDescription(members), end: null });
    const rows = getStackMergeRows({ merge, outcome: null });
    expect(rows.at(-1)).toEqual({ kind: 'missing', count: 2 });
    expect(rows).toHaveLength(3);
});

test('after a merge that stopped partway: landed, refused where it stopped, still open after it (SP59, SP60)', () => {
    const stack = sampleStack({ id: 'S_1', number: 1, members: [{ state: 'MERGED', merged: true }, {}, {}] });
    const stopped: StackMergeOutcome = { kind: 'stopped', at: stack[1]!, landed: 1, reason: REASON };
    const merge = getStackMerge({ description: sampleStackDescription(stack), end: null });
    expect(summary(getStackMergeRows({ merge, outcome: stopped }))).toEqual([
        '1 own:merged',
        '2 refused',
        '3 dimmed stillOpen',
    ]);
    const reading = getStackMergeRows({ merge, outcome: { kind: 'reading', reason: REASON } });
    expect(summary(reading)).toEqual(['1 own:merged', '2 notKnown', '3 notKnown']);
});

test('a head moved: earlier ones not merged, the one with the new commit, later ones still open (SP62)', () => {
    const stack = sampleStack({ id: 'S_1', number: 1, members: [{}, {}, {}] });
    const outcome: StackMergeOutcome = { kind: 'headMoved', pullRequest: stack[1]! };
    const merge = getStackMerge({ description: sampleStackDescription(stack), end: null });
    expect(summary(getStackMergeRows({ merge, outcome }))).toEqual([
        '1 notMerged',
        '2 newCommit',
        '3 dimmed stillOpen',
    ]);
});

test('nothing marked as landing while the whole range is blocked (SP46)', () => {
    const rows = rowsOf([{}, { behindBase: true }], { end: null });
    expect(summary(rows)).toEqual(['1 own:moving', '2 own:moving']);
});

function rowsOf(members: readonly Partial<PullRequestItem>[], params: { end: number | null }): StackMergeRow[] {
    const description = sampleStackDescription(sampleStack({ id: 'S_1', number: 1, members }));
    return getStackMergeRows({ merge: getStackMerge({ description, end: params.end }), outcome: null });
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
