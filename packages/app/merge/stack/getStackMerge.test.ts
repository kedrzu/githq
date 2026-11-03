/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { PullRequestItem } from '@/store/ItemTypes.js';
import type { StackDescription } from '@/store/stacks/describeStack.js';
import { sampleStack, sampleStackDescription } from '@/testing/sampleStacks.js';

import { getStackMerge } from './getStackMerge.js';
import { getStackMergeEnd } from './getStackMergeEnd.js';
import { moveStackMergeEnd } from './moveStackMergeEnd.js';
import type { StackMerge } from './StackMergeTypes.js';

const MERGED = { state: 'MERGED', merged: true } as const;
const CLOSED = { state: 'CLOSED' } as const;
const BLOCKED = { mergeStateStatus: 'BLOCKED' } as const;

test('the range starts at the first open member, merged ones before it listed but not going (D11)', () => {
    const description = stackOf([MERGED, {}, {}, {}]);

    const merge = getStackMerge({ description, end: null });

    expect(merge.members.map(pip => pip.kind)).toEqual(['merged', 'ready', 'ready', 'ready']);
    expect(numbers(merge.going)).toEqual([2, 3, 4]);
    // A line on a merged one moves to the first open one: the range never starts later or earlier.
    expect(numbers(getStackMerge({ description, end: 1 }).going)).toEqual([2]);
});

test('SP54: in a queue the first one’s entry is the group’s; none noted and none held, it is no queue’s business', () => {
    const entry = {
        position: 2,
        state: 'QUEUED',
        estimatedTimeToMerge: null,
        enqueuedAt: '',
        enqueuer: 'a',
        jump: false,
    } as const;

    expect(getStackMerge({ description: stackOf([{}, {}]), end: null }).queue).toBeNull();
    expect(
        getStackMerge({ description: stackOf([{ mergeQueueEntry: entry }, { mergeQueueEntry: entry }]), end: null })
            .queue,
    ).toEqual({ kind: 'in', entry });
});

test('SP54: thrown out: GitHub says UNMERGEABLE, or the entry is gone and it is still open — the first such, later ones with it', () => {
    const entry = {
        position: 2,
        state: 'QUEUED',
        estimatedTimeToMerge: null,
        enqueuedAt: '',
        enqueuer: 'a',
        jump: false,
    } as const;
    const unmergeable = { ...entry, state: 'UNMERGEABLE' } as const;

    const said = getStackMerge({
        description: stackOf([{ mergeQueueEntry: unmergeable }, { mergeQueueEntry: entry }]),
        end: null,
    }).queue;
    expect(said).toMatchObject({ kind: 'out', thrownOut: { number: 1 }, stillThere: true });

    const description = stackOf([MERGED, {}, {}]);
    const ids = description.pips.flatMap(pip => (pip.kind === 'missing' ? [] : [pip.pullRequest.id]));
    const gone = getStackMerge({ description, end: null, queued: ids }).queue;
    expect(gone).toMatchObject({ kind: 'out', thrownOut: { number: 2 }, left: [{ number: 3 }], stillThere: false });

    // Never seen in a queue, an entry gone says nothing.
    expect(getStackMerge({ description, end: null }).queue).toBeNull();
});

test('↑ and ↓ move the line one open member at a time, clamped to the first and the last open one (D18)', () => {
    const description = stackOf([MERGED, {}, {}, {}]);
    const at = (end: number | null) => getStackMerge({ description, end });

    expect(moveStackMergeEnd(at(4), 'earlier')).toBe(3);
    expect(moveStackMergeEnd(at(3), 'earlier')).toBe(2);
    expect(moveStackMergeEnd(at(2), 'earlier')).toBe(2);
    expect(moveStackMergeEnd(at(2), 'later')).toBe(3);
    expect(moveStackMergeEnd(at(4), 'later')).toBe(4);
    expect(moveStackMergeEnd(getStackMerge({ description: stackOf([MERGED, MERGED]), end: null }), 'later')).toBe(null);
});

test('the line never sits on a closed member: it moves over it, and the range keeps everything before (D11)', () => {
    const description = stackOf([{}, CLOSED, {}]);

    expect(moveStackMergeEnd(getStackMerge({ description, end: 1 }), 'later')).toBe(3);
    expect(moveStackMergeEnd(getStackMerge({ description, end: 3 }), 'earlier')).toBe(1);
    expect(numbers(getStackMerge({ description, end: 2 }).going)).toEqual([1]);
});

test('SK2: a closed last member holds nothing, as the entry reads it: every open one can land', () => {
    const description = stackOf([{}, {}, CLOSED]);

    expect(description.state.kind).toBe('ready');
    expect(getStackMerge({ description, end: null })).toMatchObject({
        canLand: 2,
        holder: null,
        block: null,
    });
});

test('SS2: the checks with two or more going are those of the one holding the rest, else of the first open one', () => {
    const held = stackOf([MERGED, {}, BLOCKED, {}]);
    const ready = stackOf([MERGED, {}, {}]);

    expect(getStackMerge({ description: held, end: 2 }).checksOf?.number).toBe(3);
    expect(getStackMerge({ description: ready, end: null }).checksOf?.number).toBe(2);
    expect(getStackMerge({ description: stackOf([MERGED, CLOSED]), end: null }).checksOf).toBe(null);
});

test('SS3: some landed and GitHub checking the first one left is fresh checks; not before anything landed, nor with one that can land (SP58)', () => {
    const running = {
        mergeStateStatus: 'BLOCKED',
        checks: { state: 'PENDING', passing: 1, failing: 0, pending: 1 },
    } as const;

    expect(getStackMerge({ description: stackOf([MERGED, running, running]), end: null }).freshChecks).toBe(true);
    expect(getStackMerge({ description: stackOf([running, running]), end: null }).freshChecks).toBe(false);
    expect(getStackMerge({ description: stackOf([MERGED, {}, running]), end: null }).freshChecks).toBe(false);
    expect(getStackMerge({ description: stackOf([MERGED, BLOCKED, running]), end: null }).freshChecks).toBe(false);
});

test('a default line: the whole stack from the entry, everything up to it from a pull request (D11)', () => {
    const description = stackOf([MERGED, {}, {}, {}]);

    expect(getStackMergeEnd({ description, openedOn: null })).toBe(4);
    expect(getStackMergeEnd({ description, openedOn: 3 })).toBe(3);
    expect(getStackMergeEnd({ description: stackOf([MERGED, MERGED]), openedOn: null })).toBe(null);
});

test('held, the line sits at the last that can land and what holds the next one is named (SP45, D19)', () => {
    const description = stackOf([{}, {}, BLOCKED, {}]);

    const end = getStackMergeEnd({ description, openedOn: null });
    expect(end).toBe(2);

    const merge = getStackMerge({ description, end });
    expect(merge).toMatchObject({ canLand: 2, block: null });
    expect(merge.holder).toEqual({ number: 3, kind: 'waiting', waitingForReview: false });

    // Moved past it, the range is held and nothing is sent.
    const past = getStackMerge({ description, end: 4 });
    expect(past.block).toEqual({ kind: 'held' });
    expect(past.holder).toEqual({ number: 3, kind: 'waiting', waitingForReview: false });
});

test('held at the first open one, the line stays where it was opened and nothing can land', () => {
    const description = stackOf([BLOCKED, {}]);

    expect(getStackMergeEnd({ description, openedOn: null })).toBe(2);
    expect(getStackMerge({ description, end: 2 })).toMatchObject({
        canLand: 0,
        block: { kind: 'held' },
    });
});

test('pull requests being merged hold nothing back: they are on their way to land', () => {
    const merging = { merging: 'SQUASH' } as const;
    const merge = getStackMerge({ description: stackOf([merging, merging, {}]), end: null });

    expect(merge.members.map(pip => pip.kind)).toEqual(['merging', 'merging', 'ready']);
    expect(merge.canLand).toBe(3);
    expect(merge.holder).toBeNull();
    expect(merge.block).toBeNull();
});

test('a closed member mid-range blocks only those after it; earlier ones can land (SP48)', () => {
    const description = stackOf([{}, {}, CLOSED, {}]);

    expect(getStackMergeEnd({ description, openedOn: null })).toBe(2);
    expect(getStackMerge({ description, end: 2 })).toMatchObject({
        canLand: 2,
        block: null,
    });
    expect(getStackMerge({ description, end: 4 })).toMatchObject({
        block: { kind: 'closed' },
    });
});

test('a draft in the range holds it (SP49)', () => {
    const description = stackOf([{}, { isDraft: true }, {}]);

    const merge = getStackMerge({ description, end: 3 });

    expect(merge.block).toEqual({ kind: 'held' });
    expect(merge.holder).toMatchObject({ number: 2, kind: 'draft' });
});

test('an incomplete copy never reads ready (D7, SP50)', () => {
    const description = stackOf([{}, {}], { size: 3 });

    for (const end of [null, 1, 2]) {
        const merge = getStackMerge({ description, end });
        expect(merge).toMatchObject({ canLand: 0, holder: null, block: { kind: 'incomplete' } });
    }

    expect(getStackMergeEnd({ description, openedOn: null })).toBe(2);
});

test('needing a rebase blocks the whole range (SP46, D8)', () => {
    const members = sampleStack({
        id: 'S_1',
        number: 1,
        members: [
            { headRefName: 'part-1' },
            { headRefName: 'part-2', baseRefName: 'part-1', behindBase: true },
            { headRefName: 'part-3', baseRefName: 'part-2' },
        ],
    });
    const description = sampleStackDescription(members);

    for (const end of [1, 2, 3]) {
        const merge = getStackMerge({ description, end });
        expect(merge).toMatchObject({
            canLand: 0,
            block: { kind: 'needsRebase', behindNumber: 2, cause: { kind: 'earlierPush', pushedNumber: 1 } },
        });
    }
});

test('a rebase needed with a base other than the one before it reads as the target moved (SP47)', () => {
    const description = stackOf([{ headRefName: 'part-1' }, { baseRefName: 'main', behindBase: true }]);

    expect(getStackMerge({ description, end: null }).block).toMatchObject({ cause: { kind: 'targetMoved' } });
});

interface DescribeOptions {
    readonly size?: number;
}

function stackOf(members: readonly Partial<PullRequestItem>[], options: DescribeOptions = {}): StackDescription {
    return sampleStackDescription(sampleStack({ id: 'S_1', number: 1, members, size: options.size }));
}

function numbers(prs: StackMerge['going']): number[] {
    return prs.map(pr => pr.number);
}
