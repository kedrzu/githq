/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { MyWorkGroup, MyWorkMembership } from '@/store/ItemStoreTypes.js';
import type { IssueItem, Item, PullRequestItem } from '@/store/ItemTypes.js';
import { groupStacks } from '@/store/stacks/groupStacks.js';
import { sampleIssue, samplePullRequest } from '@/testing/sampleItems.js';
import { sampleStack } from '@/testing/sampleStacks.js';

import type { MyWork, MyWorkFilter, MyWorkRow } from './buildMyWork.js';
import { buildMyWork } from './buildMyWork.js';

test('each item shows once, in the first group that applies: review requested, my pull requests, assigned, mentioned', () => {
    const review = pr('PR_review');
    const mine = pr('PR_mine');
    const issue = sampleIssue('I_assigned');
    const mention = sampleIssue('I_mention');

    const work = build([review, mine, issue, mention], {
        reviewRequested: [review.id],
        authored: [mine.id],
        assigned: [issue.id],
        // Every item mentions the user too.
        mentioned: [review.id, mine.id, issue.id, mention.id],
    });

    expect(rowIds(work)).toEqual({
        reviewRequested: ['PR_review'],
        authored: ['PR_mine'],
        assigned: ['I_assigned'],
        mentioned: ['I_mention'],
    });
});

test('my pull request that closes an assigned issue sits nested under it and nowhere else, and is not counted', () => {
    const issue = sampleIssue('I_1');
    const other = sampleIssue('I_2');
    const fix = pr('PR_fix', { closingIssueIds: ['I_1'] });

    const work = build([issue, other, fix], {
        authored: [fix.id],
        assigned: [issue.id, other.id],
        mentioned: [fix.id],
    });

    expect(rowIds(work)).toEqual({ reviewRequested: [], authored: [], assigned: ['I_1', 'I_2'], mentioned: [] });
    expect(nestedIds(work, 'I_1')).toEqual(['PR_fix']);
    expect(nestedIds(work, 'I_2')).toEqual([]);
    expect(work.counts).toEqual({ reviewRequested: 0, authored: 0, assigned: 2, mentioned: 0, total: 2 });
});

test('my pull request closing an issue that is not assigned to me is a plain row of "My pull requests"', () => {
    const mentioned = sampleIssue('I_mentioned');
    const fix = pr('PR_fix', { closingIssueIds: ['I_mentioned', 'I_unknown'] });

    const work = build([mentioned, fix], { authored: [fix.id], mentioned: [mentioned.id] });

    expect(rowIds(work)).toEqual({
        reviewRequested: [],
        authored: ['PR_fix'],
        assigned: [],
        mentioned: ['I_mentioned'],
    });
    expect(nestedIds(work, 'I_mentioned')).toEqual([]);
});

test('a pull request someone else opened is never nested, even when it closes my assigned issue', () => {
    const issue = sampleIssue('I_1');
    const theirs = pr('PR_theirs', { closingIssueIds: ['I_1'] });

    const work = build([issue, theirs], { reviewRequested: [theirs.id], assigned: [issue.id] });

    expect(rowIds(work).reviewRequested).toEqual(['PR_theirs']);
    expect(nestedIds(work, 'I_1')).toEqual([]);
});

test('rows are newest first; closed items and items not in the local copy yet are left out', () => {
    const older = { ...sampleIssue('I_old'), updatedAt: '2026-10-01T10:00:00Z' };
    const newer = { ...sampleIssue('I_new'), updatedAt: '2026-10-29T10:00:00Z' };
    const closed: IssueItem = { ...sampleIssue('I_closed'), state: 'CLOSED' };

    const work = build([older, newer, closed], { assigned: [older.id, closed.id, 'I_missing', newer.id] });

    expect(rowIds(work).assigned).toEqual(['I_new', 'I_old']);
    expect(work.counts.total).toBe(2);
});

test('the counts are the top-level rows of each group and "My work" is their sum', () => {
    const work = build([pr('PR_1'), pr('PR_2'), pr('PR_3'), sampleIssue('I_1'), sampleIssue('I_2')], {
        reviewRequested: ['PR_1', 'PR_2'],
        authored: ['PR_3'],
        assigned: ['I_1'],
        mentioned: ['I_2', 'PR_1'],
    });

    expect(work.counts).toEqual({ reviewRequested: 2, authored: 1, assigned: 1, mentioned: 1, total: 5 });
    for (const { group, rows } of work.groups) {
        expect(work.counts[group]).toBe(rows.length);
    }
});

test('"Needs me": reviews asked of me, my pull requests failing, sent back or conflicting, and assigned issues — not mentions', () => {
    const items: Item[] = [
        pr('PR_review', { checks: { state: 'SUCCESS', passing: 3, failing: 0, pending: 0 } }),
        pr('PR_failing', { checks: { state: 'FAILURE', passing: 1, failing: 2, pending: 0 } }),
        pr('PR_changes', { reviewDecision: 'CHANGES_REQUESTED' }),
        pr('PR_conflicts', { mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' }),
        pr('PR_waiting', { reviewDecision: 'REVIEW_REQUIRED' }),
        pr('PR_approved', { reviewDecision: 'APPROVED' }),
        sampleIssue('I_assigned'),
        sampleIssue('I_mention'),
    ];

    const work = build(
        items,
        {
            reviewRequested: ['PR_review'],
            authored: ['PR_failing', 'PR_changes', 'PR_conflicts', 'PR_waiting', 'PR_approved'],
            assigned: ['I_assigned'],
            mentioned: ['I_mention'],
        },
        'needsMe',
    );

    expect(sortedRowIds(work)).toEqual({
        reviewRequested: ['PR_review'],
        authored: ['PR_changes', 'PR_conflicts', 'PR_failing'],
        assigned: ['I_assigned'],
        mentioned: [],
    });
    expect(work.counts.total).toBe(5);
});

test('"Waiting on others": my pull requests waiting for a review or for running checks, even those that need me too', () => {
    const items: Item[] = [
        pr('PR_review_required', { reviewDecision: 'REVIEW_REQUIRED' }),
        pr('PR_requested', { reviewRequests: [{ kind: 'user', login: 'olam' }] }),
        pr('PR_running', {
            reviewDecision: 'APPROVED',
            checks: { state: 'PENDING', passing: 2, failing: 0, pending: 1 },
        }),
        // Running checks, but one already failed: it needs me, and waits on nobody.
        pr('PR_failing_running', { checks: { state: 'FAILURE', passing: 0, failing: 1, pending: 2 } }),
        // Conflicting, and still waiting for a review: in "Needs me" too.
        pr('PR_conflicts_review', {
            reviewDecision: 'REVIEW_REQUIRED',
            mergeable: 'CONFLICTING',
            mergeStateStatus: 'DIRTY',
        }),
        // A draft waits for nobody's review.
        pr('PR_draft', { isDraft: true, reviewDecision: 'REVIEW_REQUIRED' }),
        pr('PR_approved', { reviewDecision: 'APPROVED' }),
        pr('PR_others', { reviewDecision: 'REVIEW_REQUIRED' }),
        sampleIssue('I_mention'),
    ];

    const work = build(
        items,
        {
            reviewRequested: ['PR_others'],
            authored: [
                'PR_review_required',
                'PR_requested',
                'PR_running',
                'PR_failing_running',
                'PR_conflicts_review',
                'PR_draft',
                'PR_approved',
            ],
            mentioned: ['I_mention'],
        },
        'waitingOnOthers',
    );

    expect(sortedRowIds(work)).toEqual({
        reviewRequested: [],
        authored: ['PR_conflicts_review', 'PR_requested', 'PR_review_required', 'PR_running'],
        assigned: [],
        mentioned: [],
    });
});

test('a filter keeps an assigned issue as the parent of a nested pull request it matches, and counts the issue', () => {
    const waitingFix = pr('PR_waiting', { closingIssueIds: ['I_1'], reviewDecision: 'REVIEW_REQUIRED' });
    const failingFix = pr('PR_failing', {
        closingIssueIds: ['I_2'],
        checks: { state: 'FAILURE', passing: 0, failing: 1, pending: 0 },
    });
    const items: Item[] = [sampleIssue('I_1'), sampleIssue('I_2'), waitingFix, failingFix];
    const membership = { authored: [waitingFix.id, failingFix.id], assigned: ['I_1', 'I_2'] };

    const waiting = build(items, membership, 'waitingOnOthers');
    expect(rowIds(waiting).assigned).toEqual(['I_1']);
    expect(nestedIds(waiting, 'I_1')).toEqual(['PR_waiting']);
    expect(waiting.counts).toEqual({ reviewRequested: 0, authored: 0, assigned: 1, mentioned: 0, total: 1 });

    // Every assigned issue needs me, with whatever is nested under it.
    expect(sortedRowIds(build(items, membership, 'needsMe')).assigned).toEqual(['I_1', 'I_2']);
});

test('a stack is one entry, whole, in the first group any of its pull requests is in, and none of them shows again', () => {
    // Review asked on two of four; the fourth also mentions me; the first is in no group of my work.
    const stack = sampleStack({ id: 'S_1', number: 10, members: [{}, {}, {}, {}] });
    const plain = pr('PR_plain');

    const work = build([...stack, plain], {
        reviewRequested: ['PR_S_1_2', 'PR_S_1_3'],
        authored: [plain.id, 'PR_S_1_4'],
        mentioned: ['PR_S_1_4'],
    });

    expect(rowIds(work)).toEqual({ reviewRequested: ['S_1'], authored: ['PR_plain'], assigned: [], mentioned: [] });
    expect(nestedIds(work, 'S_1')).toEqual(['PR_S_1_1', 'PR_S_1_2', 'PR_S_1_3', 'PR_S_1_4']);
    expect(work.counts).toEqual({ reviewRequested: 1, authored: 1, assigned: 0, mentioned: 0, total: 2 });
});

test('without its stack in the copy each pull request of a stack is a plain row of the first group its search found', () => {
    const stack = sampleStack({ id: 'S_1', number: 10, members: [{}, {}, {}, {}] });
    const plain = pr('PR_plain');
    const items = [...stack, plain];
    const byId = new Map(items.map(item => [item.id, item]));

    const work = buildMyWork({
        membership: {
            reviewRequested: new Set(['PR_S_1_2', 'PR_S_1_3']),
            authored: new Set([plain.id, 'PR_S_1_4']),
            mentioned: new Set(['PR_S_1_4']),
        },
        getItem: id => byId.get(id),
        stacks: new Map(),
        filter: 'all',
        sort: 'updated',
    });

    expect(sortedRowIds(work)).toEqual({
        reviewRequested: ['PR_S_1_2', 'PR_S_1_3'],
        authored: ['PR_S_1_4', 'PR_plain'],
        assigned: [],
        mentioned: [],
    });
    expect(work.groups.flatMap(group => group.rows).every(row => row.stack === null)).toBe(true);
    expect(work.counts.total).toBe(4);
});

test("a stack's entry nests its open pull requests in the stack's order and opens the first not yet approved", () => {
    const stack = sampleStack({
        id: 'S_1',
        number: 10,
        members: [{ state: 'MERGED', merged: true }, {}, { reviewDecision: 'REVIEW_REQUIRED' }, { state: 'CLOSED' }],
    });

    const work = build(stack, { authored: stack.map(member => member.id) });

    const [entry] = work.groups.find(group => group.group === 'authored')?.rows ?? [];
    expect(entry?.stack?.id).toBe('S_1');
    expect(entry?.nested.map(member => member.id)).toEqual(['PR_S_1_2', 'PR_S_1_3']);
    expect(entry?.item.id).toBe('PR_S_1_3');
});

test("a stack's entry takes the place of its best sorted pull request", () => {
    const at = (hour: number) => `2026-10-20T${String(hour).padStart(2, '0')}:00:00Z`;
    const stack = sampleStack({
        id: 'S_1',
        number: 10,
        members: [{ updatedAt: at(1) }, { updatedAt: at(5) }],
    });
    const newer = pr('PR_newer', { updatedAt: at(6) });
    const between = pr('PR_between', { updatedAt: at(3) });
    const older = pr('PR_older', { updatedAt: at(0) });

    const work = build([...stack, newer, between, older], {
        authored: [older.id, 'PR_S_1_1', between.id, newer.id],
    });

    expect(rowIds(work).authored).toEqual(['PR_newer', 'S_1', 'PR_between', 'PR_older']);
});

test('a stack with one open pull request left is a plain row', () => {
    const stack = sampleStack({ id: 'S_1', number: 10, members: [{ state: 'MERGED', merged: true }, {}] });

    const work = build(stack, { authored: ['PR_S_1_2'] });

    expect(rowIds(work).authored).toEqual(['PR_S_1_2']);
    expect(work.groups.find(group => group.group === 'authored')?.rows[0]?.stack).toBeNull();
});

test('D12: my stack with a pull request closing an assigned issue goes under it, whole, and nowhere else; a plain one still nests', () => {
    const issue = sampleIssue('I_1');
    const other = sampleIssue('I_2');
    // The second closes the issue; the first is merged already; the third mentions me too.
    const stack = sampleStack({
        id: 'S_1',
        number: 10,
        members: [{ state: 'MERGED', merged: true }, { closingIssueIds: ['I_1'] }, {}, {}],
    });
    const fix = pr('PR_fix', { closingIssueIds: ['I_1'] });

    const work = build([issue, other, fix, ...stack], {
        authored: [fix.id, ...stack.map(member => member.id)],
        assigned: [issue.id, other.id],
        mentioned: ['PR_S_1_3'],
    });

    expect(rowIds(work)).toEqual({ reviewRequested: [], authored: [], assigned: ['I_1', 'I_2'], mentioned: [] });
    expect(nestedIds(work, 'I_1')).toEqual(['PR_fix']);
    const stacks = findRow(work, 'I_1')?.stacks ?? [];
    expect(stacks.map(rowId)).toEqual(['S_1']);
    expect(stacks[0]?.nested.map(member => member.id)).toEqual(['PR_S_1_2', 'PR_S_1_3', 'PR_S_1_4']);
    expect(stacks[0]?.item.id).toBe('PR_S_1_2');
    expect(findRow(work, 'I_2')?.stacks).toBeUndefined();
    expect(work.counts).toEqual({ reviewRequested: 0, authored: 0, assigned: 2, mentioned: 0, total: 2 });
});

test('D12: a stack closing two assigned issues goes under the first in the list; two stacks under one issue each stay whole', () => {
    const at = (hour: number) => `2026-10-20T${String(hour).padStart(2, '0')}:00:00Z`;
    const first = { ...sampleIssue('I_first'), updatedAt: at(9) };
    const second = { ...sampleIssue('I_second'), updatedAt: at(8) };
    const older = sampleStack({
        id: 'S_older',
        number: 10,
        members: [{ updatedAt: at(1), closingIssueIds: ['I_second'] }, { updatedAt: at(1) }],
    });
    const newer = sampleStack({
        id: 'S_newer',
        number: 20,
        members: [{ updatedAt: at(5) }, { updatedAt: at(5), closingIssueIds: ['I_second', 'I_first'] }],
    });
    const items = [first, second, ...older, ...newer];

    const work = build(items, {
        authored: [...older, ...newer].map(member => member.id),
        assigned: [second.id, first.id],
    });

    expect(rowIds(work).assigned).toEqual(['I_first', 'I_second']);
    expect(findRow(work, 'I_first')?.stacks?.map(rowId)).toEqual(['S_newer']);
    expect(findRow(work, 'I_second')?.stacks?.map(rowId)).toEqual(['S_older']);

    // Both closing one issue: under it in the order of their best sorted pull requests.
    const both = build(
        items.map(item => (item.kind === 'pullRequest' ? { ...item, closingIssueIds: ['I_second'] } : item)),
        { authored: [...older, ...newer].map(member => member.id), assigned: [second.id, first.id] },
    );
    expect(findRow(both, 'I_second')?.stacks?.map(rowId)).toEqual(['S_newer', 'S_older']);
    expect(findRow(both, 'I_first')?.stacks).toBeUndefined();
});

test('D12: a stack in another reason than "My pull requests" stays its entry there, as a plain pull request would', () => {
    const issue = sampleIssue('I_1');
    const stack = sampleStack({ id: 'S_1', number: 10, members: [{ closingIssueIds: ['I_1'] }, {}] });

    const work = build([issue, ...stack], { reviewRequested: ['PR_S_1_2'], assigned: [issue.id] });

    expect(rowIds(work)).toEqual({ reviewRequested: ['S_1'], authored: [], assigned: ['I_1'], mentioned: [] });
    expect(findRow(work, 'I_1')?.stacks).toBeUndefined();
});

test('D12: "Waiting on others" keeps an assigned issue for a stacked pull request under it that waits', () => {
    const issue = sampleIssue('I_1');
    const stack = sampleStack({
        id: 'S_1',
        number: 10,
        members: [{ closingIssueIds: ['I_1'] }, { reviewDecision: 'REVIEW_REQUIRED' }],
    });
    const idle = sampleIssue('I_2');

    const work = build(
        [issue, idle, ...stack],
        { authored: stack.map(member => member.id), assigned: [issue.id, idle.id] },
        'waitingOnOthers',
    );

    expect(rowIds(work).assigned).toEqual(['I_1']);
    expect(findRow(work, 'I_1')?.stacks?.map(rowId)).toEqual(['S_1']);
});

test("a filter keeps a stack's entry, whole, when any of its pull requests matches, and counts it once", () => {
    const failing = sampleStack({
        id: 'S_failing',
        number: 10,
        members: [{}, { checks: { state: 'FAILURE', passing: 0, failing: 1, pending: 0 } }, {}],
    });
    const approved = sampleStack({ id: 'S_approved', number: 20, members: [{}, {}] });
    const items = [...failing, ...approved];

    const work = build(items, { authored: items.map(item => item.id) }, 'needsMe');

    expect(rowIds(work).authored).toEqual(['S_failing']);
    expect(nestedIds(work, 'S_failing')).toEqual(['PR_S_failing_1', 'PR_S_failing_2', 'PR_S_failing_3']);
    expect(work.counts.total).toBe(1);
});

test("under a filter a stack's entry takes the place of its best sorted matching pull request, the others unmatched", () => {
    const at = (hour: number) => `2026-10-20T${String(hour).padStart(2, '0')}:00:00Z`;
    const failing = { state: 'FAILURE', passing: 0, failing: 1, pending: 0 } as const;
    const stack = sampleStack({
        id: 'S_1',
        number: 10,
        // The newest of the stack does not need me; the one failing is the oldest.
        members: [{ updatedAt: at(0), checks: failing }, { updatedAt: at(9) }],
    });
    const between = pr('PR_between', { updatedAt: at(3), checks: failing });

    const work = build([...stack, between], { authored: [between.id, 'PR_S_1_1', 'PR_S_1_2'] }, 'needsMe');

    expect(rowIds(work).authored).toEqual(['PR_between', 'S_1']);
    const entry = work.groups.find(group => group.group === 'authored')?.rows[1];
    expect(entry?.nested.map(member => member.id)).toEqual(['PR_S_1_1', 'PR_S_1_2']);
    expect([...(entry?.unmatched ?? [])]).toEqual(['PR_S_1_2']);
});

test('with every pull request of a stack matching, its entry has none unmatched', () => {
    const stack = sampleStack({ id: 'S_1', number: 10, members: [{}, {}] });

    const work = build(stack, { authored: stack.map(item => item.id) });

    expect(work.groups.find(group => group.group === 'authored')?.rows[0]?.unmatched).toBeNull();
});

function build(
    items: readonly Item[],
    groups: Partial<Record<MyWorkGroup, readonly string[]>>,
    filter: MyWorkFilter = 'all',
): MyWork {
    const byId = new Map(items.map(item => [item.id, item]));
    const membership: MyWorkMembership = {
        reviewRequested: new Set(groups.reviewRequested),
        authored: new Set(groups.authored),
        assigned: new Set(groups.assigned),
        mentioned: new Set(groups.mentioned),
    };

    return buildMyWork({
        membership,
        getItem: id => byId.get(id),
        stacks: groupStacks(items),
        filter,
        sort: 'updated',
    });
}

/** A pull request of the sample, with what the test is about changed. */
function pr(id: string, overrides: Partial<PullRequestItem> = {}): PullRequestItem {
    return { ...samplePullRequest(id), ...overrides };
}

function rowIds(work: MyWork): Record<MyWorkGroup, string[]> {
    const ids: Record<MyWorkGroup, string[]> = { reviewRequested: [], authored: [], assigned: [], mentioned: [] };
    for (const { group, rows } of work.groups) {
        ids[group] = rows.map(rowId);
    }

    return ids;
}

function sortedRowIds(work: MyWork): Record<MyWorkGroup, string[]> {
    const ids = rowIds(work);
    for (const group of Object.values(ids)) {
        group.sort();
    }

    return ids;
}

/** The nested ids of the row of an item, or of a stack's entry by the stack's id. */
function nestedIds(work: MyWork, id: string): string[] {
    for (const { rows } of work.groups) {
        const row = rows.find(candidate => rowId(candidate) === id);
        if (row) {
            return row.nested.map(nested => nested.id);
        }
    }

    return [];
}

/** The top-level row of an item, or of a stack's entry by the stack's id. */
function findRow(work: MyWork, id: string): MyWorkRow | undefined {
    return work.groups.flatMap(group => group.rows).find(row => rowId(row) === id);
}

/** A row's item id, or a stack entry's stack id. */
function rowId(row: MyWorkRow): string {
    return row.stack?.id ?? row.item.id;
}
