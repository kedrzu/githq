/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { Item, ItemReviewRequest, PullRequestItem } from '@/store/ItemTypes.js';
import { sampleIssue, samplePullRequest } from '@/testing/sampleItems.js';

import type { StackDescription, StackPip } from './describeStack.js';
import { describeStack } from './describeStack.js';
import { groupStacks } from './groupStacks.js';

test('the name is the title of the first issue in the copy that the stack closes, by position then by order', () => {
    const issue = { ...sampleIssue('I_named'), title: 'Offline queue for booking edits' };
    const later = { ...sampleIssue('I_later'), title: 'Later issue' };
    const otherPr = samplePullRequest('PR_closed_by_mistake');

    const description = describeMembers(
        [
            pr(1, { closingIssueIds: ['I_not_in_copy', otherPr.id] }),
            pr(2, { closingIssueIds: ['I_named', 'I_later'] }),
            pr(3, { closingIssueIds: ['I_later'] }),
        ],
        { items: [issue, later, otherPr] },
    );

    expect(description.name).toEqual({ title: 'Offline queue for booking edits', issueId: 'I_named' });
});

test('with no closed issue in the copy, the name is the first pull request title, a merged one included', () => {
    const description = describeMembers(
        [
            pr(1, { title: 'Draw the key glyphs', state: 'MERGED', merged: true }),
            pr(2, { closingIssueIds: ['I_gone'] }),
        ],
        { size: 2 },
    );

    expect(description.name).toEqual({ title: 'Draw the key glyphs', issueId: null });
});

test('every open pull request able to merge reads ready', () => {
    const description = describeMembers([
        pr(1),
        pr(2, { mergeStateStatus: 'HAS_HOOKS' }),
        pr(3, { mergeStateStatus: 'UNSTABLE' }),
    ]);

    expect(description.state).toEqual({ kind: 'ready', openCount: 3 });
    expect(pipKinds(description)).toEqual(['ready', 'ready', 'ready']);
    expect(description).toMatchObject({ size: 3, held: 3, landed: 0 });
});

test('the blocker is the first open one from the bottom that cannot merge; the ready count stops there', () => {
    const description = describeMembers(
        [
            pr(1),
            pr(2, { mergeStateStatus: 'BLOCKED', checks: { state: 'FAILURE', passing: 3, failing: 1, pending: 0 } }),
            pr(3),
            pr(4, { mergeStateStatus: 'BLOCKED' }),
        ],
        { size: 4 },
    );

    expect(description.state).toEqual({
        kind: 'held',
        readyCount: 1,
        openCount: 4,
        blocker: { number: 102, kind: 'broken', waitingForReview: false },
    });
    // A later one stays green on its own pip (D5).
    expect(pipKinds(description)).toEqual(['ready', 'broken', 'ready', 'waiting']);
});

test('a lowest open one that cannot merge blocks the whole stack, and is named', () => {
    const description = describeMembers([pr(1, { mergeStateStatus: 'BLOCKED' }), pr(2), pr(3)]);

    expect(description.state).toEqual({
        kind: 'held',
        readyCount: 0,
        openCount: 3,
        blocker: { number: 101, kind: 'waiting', waitingForReview: false },
    });
});

test('a blocker waiting for a review says so', () => {
    const description = describeMembers(
        [pr(1), pr(2, { mergeStateStatus: 'BLOCKED', reviewDecision: 'REVIEW_REQUIRED' })],
        {
            size: 2,
        },
    );

    expect(description.state).toEqual({
        kind: 'held',
        readyCount: 1,
        openCount: 2,
        blocker: { number: 102, kind: 'waiting', waitingForReview: true },
    });
});

test('a draft blocks what comes after it, and the blocker says it is a draft', () => {
    const description = describeMembers([pr(1), pr(2, { isDraft: true, mergeStateStatus: 'DRAFT' }), pr(3)]);

    expect(description.state).toEqual({
        kind: 'held',
        readyCount: 1,
        openCount: 3,
        blocker: { number: 102, kind: 'draft', waitingForReview: false },
    });
    expect(pipKinds(description)).toEqual(['ready', 'draft', 'ready']);
});

test('a partly merged stack counts what landed and is ready from the lowest open one', () => {
    const description = describeMembers([
        pr(1, { state: 'MERGED', merged: true }),
        pr(2, { mergeStateStatus: 'BLOCKED', checks: { state: 'PENDING', passing: 1, failing: 0, pending: 2 } }),
        pr(3),
    ]);

    expect(description.landed).toBe(1);
    expect(description.state).toEqual({
        kind: 'held',
        readyCount: 0,
        openCount: 2,
        blocker: { number: 102, kind: 'moving', waitingForReview: false },
    });
    expect(pipKinds(description)).toEqual(['merged', 'moving', 'ready']);
});

test('fewer pull requests in the copy than the size never reads ready, and the missing places are pips', () => {
    const description = describeMembers([pr(1), pr(3)], { size: 4 });

    expect(description.state).toEqual({ kind: 'incomplete' });
    expect(description).toMatchObject({ size: 4, held: 2 });
    // Pale, no green (D7, SP14).
    expect(description.pips.map(pipLabel)).toEqual(['waiting', 'missing 2', 'waiting', 'missing 4']);
});

test('an incomplete copy draws every pip it holds pale, whatever their own states', () => {
    const description = describeMembers(
        [
            pr(1, { state: 'MERGED', merged: true }),
            pr(2, { checks: { state: 'FAILURE', passing: 0, failing: 1, pending: 0 } }),
        ],
        { size: 3 },
    );

    expect(description.pips.map(pipLabel)).toEqual(['waiting', 'waiting', 'missing 3']);
});

test('an incomplete copy goes before needing a rebase or being merged', () => {
    expect(describeMembers([pr(1), pr(2, { behindBase: true })], { size: 3 }).state).toEqual({ kind: 'incomplete' });
    expect(describeMembers([pr(1, { state: 'MERGED', merged: true })], { size: 2 }).state).toEqual({
        kind: 'incomplete',
    });

    const merged = describeMembers(
        [pr(1, { state: 'MERGED', merged: true }), pr(2, { state: 'MERGED', merged: true })],
        {
            size: 2,
        },
    );
    expect(merged.state).toEqual({ kind: 'merged' });
    expect(merged.landed).toBe(2);
    expect(pipKinds(merged)).toEqual(['merged', 'merged']);
});

test('an open one above the lowest open one behind its base needs a rebase, and every open pip is amber (D21)', () => {
    const description = describeMembers([
        pr(1, { state: 'MERGED', merged: true }),
        pr(2),
        pr(3, { behindBase: true }),
        pr(4, { behindBase: true }),
    ]);

    expect(description.state).toEqual({ kind: 'needsRebase', behindNumber: 103 });
    expect(pipKinds(description)).toEqual(['merged', 'moving', 'moving', 'moving']);
});

test('the lowest open one behind its base alone does not need a rebase', () => {
    const description = describeMembers([pr(1, { state: 'MERGED', merged: true }), pr(2, { behindBase: true }), pr(3)]);

    expect(description.state).toEqual({ kind: 'ready', openCount: 2 });
    expect(pipKinds(description)).toEqual(['merged', 'ready', 'ready']);
});

test('a closed one with open ones after it names itself and how many are stuck', () => {
    const description = describeMembers(
        [pr(1, { state: 'MERGED', merged: true }), pr(2, { state: 'CLOSED' }), pr(3), pr(4)],
        { size: 4 },
    );

    expect(description.state).toEqual({ kind: 'closedInside', closedNumber: 102, stuckCount: 2 });
    expect(pipKinds(description)).toEqual(['merged', 'closed', 'ready', 'ready']);
});

test('a closed one at the top does not hold the open ones before it', () => {
    const description = describeMembers([pr(1), pr(2), pr(3, { state: 'CLOSED' })]);

    expect(description.state).toEqual({ kind: 'ready', openCount: 2 });
});

test('a stack with nothing open and not all merged reads closed', () => {
    const description = describeMembers([pr(1, { state: 'MERGED', merged: true }), pr(2, { state: 'CLOSED' })], {
        size: 2,
    });

    expect(description.state).toEqual({ kind: 'closed' });
});

test("someone else's stack says on how many open ones the viewer's review is asked, how many are ready and what stops it", () => {
    const asked: ItemReviewRequest[] = [{ kind: 'user', login: 'me' }];
    const team: ItemReviewRequest[] = [{ kind: 'team', slug: 'web', name: 'Web' }];
    const description = describeMembers(
        [
            pr(1, { reviewRequests: asked }),
            pr(2, { isDraft: true, mergeStateStatus: 'DRAFT', reviewRequests: team }),
            pr(3, { mergeStateStatus: 'BLOCKED', reviewRequests: asked }),
            pr(4, { mergeStateStatus: 'BLOCKED' }),
        ],
        { size: 4, viewer: 'me' },
    );

    expect(description.state).toEqual({
        kind: 'reviewRequested',
        requestedCount: 2,
        openCount: 4,
        readyCount: 1,
        blocker: { number: 102, kind: 'draft', waitingForReview: false },
    });
});

test("the viewer's own stack never reads as asking for their review", () => {
    const description = describeMembers(
        [pr(1, { author: { login: 'me', avatarUrl: '' } }), pr(2, { reviewRequests: [{ kind: 'user', login: 'me' }] })],
        { size: 2, viewer: 'me' },
    );

    expect(description.state).toEqual({ kind: 'ready', openCount: 2 });
});

test('a review request yields to a stack that needs a rebase', () => {
    const description = describeMembers(
        [pr(1), pr(2, { behindBase: true, reviewRequests: [{ kind: 'user', login: 'me' }] })],
        { size: 2, viewer: 'me' },
    );

    expect(description.state).toEqual({ kind: 'needsRebase', behindNumber: 102 });
});

test('the updated time is the latest of its pull requests', () => {
    const description = describeMembers([
        pr(1, { updatedAt: '2026-10-20T10:00:00Z' }),
        pr(2, { updatedAt: '2026-10-29T08:00:00Z' }),
        pr(3, { updatedAt: '2026-10-25T10:00:00Z' }),
    ]);

    expect(description.updatedAt).toBe('2026-10-29T08:00:00Z');
});

/** What a test describes a stack with. */
interface DescribeOptions {
    readonly size?: number;
    readonly viewer?: string;
    readonly items?: readonly Item[];
}

function describeMembers(members: readonly PullRequestItem[], options: DescribeOptions = {}): StackDescription {
    const size = options.size ?? 3;
    const sized = members.map(member => ({
        ...member,
        stack: { id: 'S_1', number: 7, size, position: member.number - 100 },
    }));
    const stack = groupStacks(sized).get('S_1');
    if (!stack) {
        throw new Error('No stack');
    }

    const items = new Map((options.items ?? []).map(item => [item.id, item]));
    return describeStack({ stack, viewerLogin: options.viewer ?? 'octocat', getItem: id => items.get(id) });
}

/** The pull request at a position of the stack: #101 is first. */
function pr(position: number, overrides: Partial<PullRequestItem> = {}): PullRequestItem {
    return { ...samplePullRequest(`PR_${position}`), number: 100 + position, ...overrides };
}

function pipKinds(description: StackDescription): string[] {
    return description.pips.map(pip => pip.kind);
}

function pipLabel(pip: StackPip): string {
    return pip.kind === 'missing' ? `missing ${pip.position}` : pip.kind;
}
