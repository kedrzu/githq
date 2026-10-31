/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { MyWorkGroup, MyWorkMembership } from '@/store/ItemStoreTypes.js';
import type { IssueItem, Item, PullRequestItem } from '@/store/ItemTypes.js';
import { sampleIssue, samplePullRequest } from '@/testing/sampleItems.js';

import type { MyWork, MyWorkFilter } from './buildMyWork.js';
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

    return buildMyWork({ membership, getItem: id => byId.get(id), filter, sort: 'updated' });
}

/** A pull request of the sample, with what the test is about changed. */
function pr(id: string, overrides: Partial<PullRequestItem> = {}): PullRequestItem {
    return { ...samplePullRequest(id), ...overrides };
}

function rowIds(work: MyWork): Record<MyWorkGroup, string[]> {
    const ids: Record<MyWorkGroup, string[]> = { reviewRequested: [], authored: [], assigned: [], mentioned: [] };
    for (const { group, rows } of work.groups) {
        ids[group] = rows.map(row => row.item.id);
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

function nestedIds(work: MyWork, issueId: string): string[] {
    for (const { rows } of work.groups) {
        const row = rows.find(candidate => candidate.item.id === issueId);
        if (row) {
            return row.nested.map(nested => nested.id);
        }
    }

    return [];
}
