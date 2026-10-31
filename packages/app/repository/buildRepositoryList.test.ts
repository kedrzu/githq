/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { ItemSort } from '@/lists/ItemSort.js';
import type { ListGroup } from '@/lists/ListTypes.js';
import type { IssueItem, Item, PullRequestItem } from '@/store/ItemTypes.js';
import { sampleIssue, samplePullRequest } from '@/testing/sampleItems.js';

import type { RepositoryKind, RepositoryListTexts, RepositoryState } from './buildRepositoryList.js';
import { buildRepositoryList } from './buildRepositoryList.js';
import type { RepositoryGrouping } from './repositoryViewOptions.js';

const TEXTS: RepositoryListTexts = {
    all: 'All',
    noMilestone: 'No milestone',
    noLabel: 'No label',
    unassigned: 'Unassigned',
    noType: 'No type',
    issues: 'Issues',
    pullRequests: 'Pull requests',
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

test('grouped by label or assignee, an item with two is under both; by issue type, pull requests have none', () => {
    const tagged = issue('I_1', {
        labels: [
            { name: 'bug', color: 'e5534b' },
            { name: 'calendar', color: '4493f8' },
        ],
        assignees: [{ login: 'olam', avatarUrl: 'olam.png' }],
        issueType: { name: 'Bug', color: 'RED' },
    });
    const plain = pullRequest('PR_2');

    expect(summarize(build([tagged, plain], { grouping: 'label' }).groups)).toEqual([
        ['bug', ['I_1']],
        ['calendar', ['I_1']],
        ['', ['PR_2']],
    ]);
    expect(summarize(build([tagged, plain], { grouping: 'assignee' }).groups)).toEqual([
        ['olam', ['I_1']],
        ['', ['PR_2']],
    ]);
    expect(summarize(build([tagged, plain], { grouping: 'issueType' }).groups)).toEqual([
        ['Bug', ['I_1']],
        ['', ['PR_2']],
    ]);
});

test('by kind: issues then pull requests, nothing to move between them; without grouping one group', () => {
    const items = [pullRequest('PR_1'), issue('I_2')];

    const byKind = build(items, { grouping: 'kind' }).groups;
    expect(summarize(byKind)).toEqual([
        ['issue', ['I_2']],
        ['pullRequest', ['PR_1']],
    ]);
    expect(byKind.some(group => group.droppable)).toBe(false);
    expect(summarize(build(items, { grouping: 'none' }).groups)).toEqual([['all', ['I_2', 'PR_1']]]);
});

test('state and kind filter the list; the kind tabs count what the state leaves, newest first', () => {
    const items = [
        issue('I_open', { updatedAt: '2026-10-29T10:00:00Z' }),
        issue('I_closed', { state: 'CLOSED' }),
        pullRequest('PR_merged', { state: 'MERGED', merged: true }),
        pullRequest('PR_open', { updatedAt: '2026-10-30T10:00:00Z' }),
    ];

    const open = build(items, { grouping: 'none' });
    expect(summarize(open.groups)).toEqual([['all', ['PR_open', 'I_open']]]);
    expect(open.counts).toEqual({ all: 2, issues: 1, pullRequests: 1 });

    const closedPullRequests = build(items, { grouping: 'none', state: 'closed', kind: 'pullRequests' });
    expect(summarize(closedPullRequests.groups)).toEqual([['all', ['PR_merged']]]);
    expect(closedPullRequests.counts).toEqual({ all: 2, issues: 1, pullRequests: 1 });

    expect(build(items, { grouping: 'none', state: 'all', sort: 'title' }).counts.all).toBe(4);
});

interface BuildOptions {
    readonly grouping: RepositoryGrouping;
    readonly state?: RepositoryState;
    readonly kind?: RepositoryKind;
    readonly sort?: ItemSort;
}

function build(items: readonly Item[], options: BuildOptions) {
    return buildRepositoryList({
        items,
        grouping: options.grouping,
        state: options.state ?? 'open',
        kind: options.kind ?? 'all',
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
