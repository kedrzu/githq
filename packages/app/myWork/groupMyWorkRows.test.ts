/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { MyWorkGroup, MyWorkMembership } from '@/store/ItemStoreTypes.js';
import type { Item, PullRequestItem } from '@/store/ItemTypes.js';
import { samplePullRequest } from '@/testing/sampleItems.js';
import { sampleMembership, sampleMyWork } from '@/testing/sampleMyWork.js';
import {
    sampleStack,
    STACKED_MY_WORK_ITEMS,
    STACKED_MY_WORK_MEMBERSHIP,
    TWO_STACKS_UNDER_ISSUE_ITEMS,
    TWO_STACKS_UNDER_ISSUE_MEMBERSHIP,
} from '@/testing/sampleStacks.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import type { MyWork, MyWorkFilter, MyWorkRow, MyWorkStatus } from './buildMyWork.js';
import { getMyWorkStatus } from './buildMyWork.js';
import type { MyWorkRowBucket } from './groupMyWorkRows.js';
import { groupMyWorkByAuthor, groupMyWorkByStatus } from './groupMyWorkRows.js';

const ME = { login: SAMPLE_VIEWER.login, avatarUrl: 'https://avatars.test/me' };
const DRAFT: PullRequestItem = { ...samplePullRequest('PR_draft'), author: ME, isDraft: true };
const GHOST: PullRequestItem = { ...samplePullRequest('PR_ghost'), author: null };
/** My stack whose entry opens its first, waiting for review, while its second, approved, fails its checks. */
const SPLIT_STACK = sampleStack({
    id: 'S_split',
    number: 70,
    members: [
        { author: ME, reviewDecision: 'REVIEW_REQUIRED', mergeStateStatus: 'BLOCKED' },
        { author: ME, checks: { state: 'FAILURE', passing: 3, failing: 1, pending: 0 } },
    ],
});

/**
 * Every kind of row at once: reviews asked, a stack asking my review, my stacks, my pull requests ready, failing and
 * waiting, my draft, assigned issues with a pull request and two stacks nested under one, mentions, a ghost's pull
 * request.
 */
const ITEMS: readonly Item[] = [
    ...new Map([...STACKED_MY_WORK_ITEMS, ...TWO_STACKS_UNDER_ISSUE_ITEMS].map(item => [item.id, item])).values(),
    DRAFT,
    GHOST,
    ...SPLIT_STACK,
];
const MEMBERSHIP: MyWorkMembership = sampleMembership({
    reviewRequested: union('reviewRequested'),
    authored: [...union('authored'), DRAFT.id, ...SPLIT_STACK.map(pr => pr.id)],
    assigned: union('assigned'),
    mentioned: [...union('mentioned'), GHOST.id],
});
const WORK = sampleMyWork(ITEMS, MEMBERSHIP, 'all');

test('"Needs me" holds exactly what its filter keeps, "Waiting on others" what its filter keeps and "Needs me" does not', () => {
    const needsMe = keptBy('needsMe');
    const waiting = keptBy('waitingOnOthers');
    const byStatus = new Map(groupMyWorkByStatus(WORK.groups).map(({ key, rows }) => [key, rows.map(rowKey)]));

    expect(new Set(byStatus.get('needsMe'))).toEqual(needsMe);
    expect(new Set(byStatus.get('waitingOnOthers'))).toEqual(waiting.difference(needsMe));
    // The sample has them all, so the comparison says something.
    expect(needsMe.size).toBeGreaterThan(0);
    expect(waiting.intersection(needsMe).size).toBeGreaterThan(0);
    expect(waiting.difference(needsMe).size).toBeGreaterThan(0);
});

test("a stack's entry needs me when any of its pull requests does, though the one it opens only waits", () => {
    const entry = allRows(WORK).find(candidate => candidate.stack?.id === 'S_split');

    expect(entry?.item.id).toBe('PR_S_split_1');
    expect(entry && getMyWorkStatus(entry, 'authored')).toBe('needsMe');
    expect(entry && getMyWorkStatus({ ...entry, stack: null }, 'authored')).toBe('waitingOnOthers');
});

test("by status: in the statuses' order, only those with rows; my approved pull request ready, my draft a draft", () => {
    const grouped = groupMyWorkByStatus(WORK.groups);

    expect(grouped.map(bucket => bucket.key)).toEqual(['needsMe', 'readyToMerge', 'waitingOnOthers', 'draft', 'other']);
    expect(idsOf(grouped, 'readyToMerge')).toContain('PR_477');
    expect(idsOf(grouped, 'draft')).toEqual(['PR_draft']);
    // A mention alone never needs me; someone's draft I am mentioned on is no draft of mine.
    expect(idsOf(grouped, 'other')).toEqual(expect.arrayContaining(['I_463', 'PR_94']));
    expect(getMyWorkStatus(row(DRAFT), 'mentioned')).toBe('other');
    expect(groupMyWorkByStatus([])).toEqual([]);
});

test('by status or by author: every row once, the counts summing to the total, nested rows and stacks still under their issue', () => {
    for (const grouped of [groupMyWorkByStatus(WORK.groups), groupMyWorkByAuthor(WORK.groups)]) {
        const rows = grouped.flatMap(bucket => bucket.rows);
        expect(rows.length).toBe(WORK.counts.total);
        expect(new Set(rows.map(rowKey)).size).toBe(rows.length);

        expect(rows.find(entry => entry.item.id === 'I_1187')?.nested.map(pr => pr.id)).toEqual(['PR_1205']);
        expect(rows.some(entry => entry.item.id === 'PR_1205')).toBe(false);
        expect(rows.find(entry => entry.item.id === 'I_12')?.stacks?.map(stack => stack.stack?.id)).toEqual([
            'S_sync',
            'S_failover',
        ]);
        const webhooks = rows.find(entry => entry.stack?.id === 'S_webhooks');
        expect(webhooks?.nested).toHaveLength(4);
    }
});

test('by author: by login, rows in reason order inside each, those without an author last', () => {
    const grouped = groupMyWorkByAuthor(WORK.groups);
    const logins = grouped.map(bucket => bucket.author?.login ?? null);

    const named = logins.filter(login => login !== null);
    expect(named).toEqual(named.toSorted((a, b) => a.localeCompare(b)));
    expect(logins.at(-1)).toBeNull();
    expect(grouped.at(-1)?.rows.map(rowKey)).toEqual(['PR_ghost']);

    const olam = grouped.find(bucket => bucket.author?.login === 'olam');
    // Review requested first, then the mention — reason order, not age.
    expect(olam?.rows.map(rowKey)).toEqual(['PR_482', 'I_463']);
});

function keptBy(filter: MyWorkFilter) {
    return new Set(allRows(sampleMyWork(ITEMS, MEMBERSHIP, filter)).map(rowKey));
}

function allRows(work: MyWork): MyWorkRow[] {
    return work.groups.flatMap(group => group.rows);
}

function idsOf(grouped: readonly MyWorkRowBucket<MyWorkStatus>[], key: MyWorkStatus) {
    return grouped.find(bucket => bucket.key === key)?.rows.map(rowKey) ?? [];
}

/** A stack's entry by its stack: under a filter its `item` may be another of its pull requests. */
function rowKey(entry: MyWorkRow) {
    return entry.stack?.id ?? entry.item.id;
}

function row(item: Item): MyWorkRow {
    return { item, nested: [], stack: null };
}

function union(group: MyWorkGroup): string[] {
    return [
        ...new Set([...(STACKED_MY_WORK_MEMBERSHIP[group] ?? []), ...(TWO_STACKS_UNDER_ISSUE_MEMBERSHIP[group] ?? [])]),
    ];
}
