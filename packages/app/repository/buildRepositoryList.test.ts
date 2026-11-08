/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { ItemSort } from '@/lists/ItemSort.js';
import type { ListGroup } from '@/lists/ListTypes.js';
import type { IssueItem, Item, PullRequestItem } from '@/store/ItemTypes.js';
import { sampleIssue, samplePullRequest } from '@/testing/sampleItems.js';

import type { RepositoryListTexts, RepositoryState } from './buildRepositoryList.js';
import { buildRepositoryList } from './buildRepositoryList.js';
import type { RepositoryGrouping } from './repositoryViewOptions.js';

const TEXTS: RepositoryListTexts = {
    all: 'All',
    noMilestone: 'No milestone',
    noLabel: 'No label',
    unassigned: 'Unassigned',
    noType: 'No type',
    noAuthor: 'No author',
    pullRequestStages: {
        draft: 'Draft',
        waitingForReview: 'Waiting for review',
        needsWork: 'Needs work',
        checksRunning: 'Checks running',
        readyToMerge: 'Ready to merge',
        merging: 'Merging',
        merged: 'Merged',
        closed: 'Closed',
    },
    issueStatuses: { open: 'Open', closed: 'Closed', notPlanned: 'Not planned' },
    milestoneDetail: ({ closed, total, dueOn }) => `${closed}/${total}${dueOn ? ` due ${dueOn}` : ''}`,
};

test('J1: grouped by milestone — the soonest due first, those without a date after, items without one last; progress counts closed ones too', () => {
    const items = [
        issue('I_1', { milestone: { title: 'v4.3', dueOn: '2026-12-13' } }),
        issue('I_2', { milestone: { title: 'v4.2', dueOn: '2026-11-15' } }),
        issue('I_3', { milestone: { title: 'v4.2', dueOn: '2026-11-15' }, state: 'CLOSED' }),
        issue('I_4', { milestone: { title: 'Someday', dueOn: null } }),
        issue('I_5'),
    ];

    const { groups } = build(items, { grouping: 'milestone' });

    expect(summarize(groups)).toEqual([
        ['v4.2', ['I_2']],
        ['v4.3', ['I_1']],
        ['Someday', ['I_4']],
        ['', ['I_5']],
    ]);
    expect(groups.map(group => group.detail)).toEqual(['1/2 due 2026-11-15', '0/1 due 2026-12-13', '0/1', null]);
    expect(groups.map(group => group.label)).toContain('No milestone');
});

test('on its way, a state with nothing listed yet is still arriving, its groups not known, never a list with nothing; what is listed shows', () => {
    expect(build([], { grouping: 'milestone', arriving: true })).toEqual({
        groups: [],
        count: 0,
        held: 0,
        arriving: true,
    });
    expect(build([], { grouping: 'milestone' })).toEqual({
        groups: [],
        count: 0,
        held: 0,
        arriving: false,
    });

    const kept = build([issue('I_1')], { grouping: 'none', arriving: true });
    expect(summarize(kept.groups)).toEqual([['all', ['I_1']]]);
    expect(kept.arriving).toBe(false);
});

test('grouped by label or assignee, an item with two is under both; by issue type, those without one last', () => {
    const tagged = issue('I_1', {
        labels: [
            { name: 'bug', color: 'e5534b' },
            { name: 'calendar', color: '4493f8' },
        ],
        assignees: [{ login: 'olam', avatarUrl: 'olam.png' }],
        issueType: { name: 'Bug', color: 'RED' },
    });
    const plain = issue('I_2');

    expect(summarize(build([tagged, plain], { grouping: 'label' }).groups)).toEqual([
        ['bug', ['I_1']],
        ['calendar', ['I_1']],
        ['', ['I_2']],
    ]);
    expect(summarize(build([tagged, plain], { grouping: 'assignee' }).groups)).toEqual([
        ['olam', ['I_1']],
        ['', ['I_2']],
    ]);
    expect(summarize(build([tagged, plain], { grouping: 'issueType' }).groups)).toEqual([
        ['Bug', ['I_1']],
        ['', ['I_2']],
    ]);
});

test('by status, each pull request is under the one stage its row tells, the stages in their order, only those with some', () => {
    const items = [
        pullRequest('PR_closed', { state: 'CLOSED' }),
        pullRequest('PR_merged', { state: 'MERGED', merged: true }),
        pullRequest('PR_approved', { reviewDecision: 'APPROVED' }),
        pullRequest('PR_changes', { reviewDecision: 'CHANGES_REQUESTED' }),
        pullRequest('PR_waiting', { reviewDecision: 'REVIEW_REQUIRED' }),
        pullRequest('PR_draft', { isDraft: true }),
        pullRequest('PR_draft2', { isDraft: true }),
    ];

    const { groups, count } = build(items, { grouping: 'status', state: 'all', kind: 'pullRequest' });

    expect(summarize(groups)).toEqual([
        ['draft', ['PR_draft', 'PR_draft2']],
        ['waitingForReview', ['PR_waiting']],
        ['needsWork', ['PR_changes']],
        ['readyToMerge', ['PR_approved']],
        ['merged', ['PR_merged']],
        ['closed', ['PR_closed']],
    ]);
    expect(groups.map(group => group.label)).toEqual([
        'Draft',
        'Waiting for review',
        'Needs work',
        'Ready to merge',
        'Merged',
        'Closed',
    ]);
    expect(count).toBe(items.length);
    expect(groups.every(group => !group.droppable)).toBe(true);
});

test('by status, an issue is open, closed (completed or with no reason) or not planned (any other reason), in that order', () => {
    const items = [
        issue('I_duplicate', { state: 'CLOSED', stateReason: 'DUPLICATE' }),
        issue('I_notPlanned', { state: 'CLOSED', stateReason: 'NOT_PLANNED' }),
        issue('I_noReason', { state: 'CLOSED', stateReason: null }),
        issue('I_completed', { state: 'CLOSED', stateReason: 'COMPLETED' }),
        issue('I_open'),
    ];

    const { groups } = build(items, { grouping: 'status', state: 'all' });

    expect(summarize(groups)).toEqual([
        ['open', ['I_open']],
        ['closed', ['I_completed', 'I_noReason']],
        ['notPlanned', ['I_duplicate', 'I_notPlanned']],
    ]);
    expect(groups.map(group => group.label)).toEqual(['Open', 'Closed', 'Not planned']);
    expect(groups.every(group => !group.droppable)).toBe(true);

    // Open only: the other statuses have no items and show no group.
    expect(summarize(build(items, { grouping: 'status' }).groups)).toEqual([['open', ['I_open']]]);
});

test('by author, by login, an item whose author is gone last under "No author"; never droppable', () => {
    const items = [
        issue('I_gone', { author: null }),
        issue('I_zed', { author: { login: 'zed', avatarUrl: 'zed.png' } }),
        issue('I_ada', { author: { login: 'ada', avatarUrl: 'ada.png' } }),
        issue('I_zed2', { author: { login: 'zed', avatarUrl: 'zed.png' } }),
    ];

    const { groups } = build(items, { grouping: 'author' });

    expect(summarize(groups)).toEqual([
        ['ada', ['I_ada']],
        ['zed', ['I_zed', 'I_zed2']],
        ['', ['I_gone']],
    ]);
    expect(groups.at(-1)?.label).toBe('No author');
    expect(groups.every(group => !group.droppable)).toBe(true);
});

test('D14: a section lists one kind of item in the state chosen, newest first, and counts what it lists once', () => {
    const items = [
        issue('I_open', { updatedAt: '2026-10-29T10:00:00Z' }),
        issue('I_older', { updatedAt: '2026-10-28T10:00:00Z' }),
        issue('I_closed', { state: 'CLOSED' }),
        pullRequest('PR_merged', { state: 'MERGED', merged: true }),
        pullRequest('PR_open', { updatedAt: '2026-10-30T10:00:00Z' }),
    ];

    const issues = build(items, { grouping: 'none' });
    expect(summarize(issues.groups)).toEqual([['all', ['I_open', 'I_older']]]);
    expect(issues.count).toBe(2);

    const closedPullRequests = build(items, { grouping: 'none', state: 'closed', kind: 'pullRequest' });
    expect(summarize(closedPullRequests.groups)).toEqual([['all', ['PR_merged']]]);
    expect(closedPullRequests.count).toBe(1);

    expect(build(items, { grouping: 'none', state: 'all', kind: 'pullRequest' }).count).toBe(2);

    // An item under two labels is listed once.
    const twoLabels = issue('I_two', {
        labels: [
            { name: 'bug', color: 'e5534b' },
            { name: 'ui', color: '4493f8' },
        ],
    });
    expect(build([twoLabels], { grouping: 'label' }).count).toBe(1);
});

interface BuildOptions {
    readonly grouping: RepositoryGrouping;
    readonly state?: RepositoryState;
    readonly kind?: Item['kind'];
    readonly sort?: ItemSort;
    readonly arriving?: boolean;
}

function build(items: readonly Item[], options: BuildOptions) {
    return buildRepositoryList({
        items,
        grouping: options.grouping,
        state: options.state ?? 'open',
        kind: options.kind ?? 'issue',
        sort: options.sort ?? 'updated',
        texts: TEXTS,
        arriving: options.arriving,
    });
}

function issue(id: string, overrides: Partial<IssueItem> = {}): IssueItem {
    return { ...sampleIssue(id), ...overrides };
}

function pullRequest(id: string, overrides: Partial<PullRequestItem> = {}): PullRequestItem {
    return { ...samplePullRequest(id), ...overrides };
}

function summarize(groups: readonly ListGroup<Item>[]) {
    return groups.map(group => [group.key, group.rows.map(row => row.id)]);
}
