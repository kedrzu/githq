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
}

function build(items: readonly Item[], options: BuildOptions) {
    return buildRepositoryList({
        items,
        grouping: options.grouping,
        state: options.state ?? 'open',
        kind: options.kind ?? 'issue',
        sort: options.sort ?? 'updated',
        texts: TEXTS,
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
