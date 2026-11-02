/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { D1_ITEMS, D1_MEMBERSHIP, sampleMyWork } from '@/testing/sampleMyWork.js';
import { STACKED_MY_WORK_ITEMS, STACKED_MY_WORK_MEMBERSHIP } from '@/testing/sampleStacks.js';

import { groupMyWorkByRepository } from './groupMyWorkByRepository.js';

const work = sampleMyWork(D1_ITEMS, D1_MEMBERSHIP, 'all');

test('a group per tracked repository in the tracking order, those without rows left out, then the untracked ones', () => {
    const grouped = groupMyWorkByRepository(work.groups, [
        'kedrzu/githq',
        'acme/empty',
        'kedrzu/skills',
        'skyline-labs/portal',
        'skyline-labs/api',
    ]);

    expect(grouped.map(group => [group.repository, group.rows.map(row => row.item.id)])).toEqual([
        ['kedrzu/githq', ['PR_15', 'I_12', 'I_9']],
        ['kedrzu/skills', ['I_31']],
        // Review requested first, then the assigned issue — reason order, not age.
        ['skyline-labs/portal', ['PR_1203', 'I_1187']],
        ['skyline-labs/api', ['PR_482', 'PR_477', 'I_463']],
        [null, ['PR_18842', 'PR_94']],
    ]);
});

test('every row of my work once, the nested pull request still under its issue, and the counts summing to the total', () => {
    const grouped = groupMyWorkByRepository(work.groups, ['skyline-labs/portal']);

    const rows = grouped.flatMap(group => group.rows);
    expect(rows.length).toBe(work.counts.total);
    expect(new Set(rows.map(row => row.item.id)).size).toBe(rows.length);
    expect(rows.find(row => row.item.id === 'I_1187')?.nested.map(nested => nested.id)).toEqual(['PR_1205']);
    expect(rows.some(row => row.item.id === 'PR_1205')).toBe(false);
});

test('nothing tracked: one group of other repositories; nothing at all: no groups', () => {
    expect(groupMyWorkByRepository(work.groups, []).map(group => group.repository)).toEqual([null]);
    expect(groupMyWorkByRepository([], ['kedrzu/githq'])).toEqual([]);
});

test("a stack's entry stays whole in its repository's group, in the place of the first reason any of its pull requests has", () => {
    const stacked = sampleMyWork(STACKED_MY_WORK_ITEMS, STACKED_MY_WORK_MEMBERSHIP, 'all');
    const grouped = groupMyWorkByRepository(stacked.groups, ['fitloop/api', 'fitloop/webapp']);

    const rows = grouped.map(group => [group.repository, group.rows.map(row => row.stack?.id ?? row.item.id)]);
    expect(rows.slice(0, 2)).toEqual([
        ['fitloop/api', ['S_webhooks']],
        ['fitloop/webapp', ['S_calendar']],
    ]);
    const webhooks = grouped[0]?.rows[0];
    expect(webhooks?.nested.map(pr => pr.id)).toEqual([
        'PR_S_webhooks_1',
        'PR_S_webhooks_2',
        'PR_S_webhooks_3',
        'PR_S_webhooks_4',
    ]);
    expect(grouped.flatMap(group => group.rows).length).toBe(stacked.counts.total);
});
