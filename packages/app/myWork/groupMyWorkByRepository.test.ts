/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { D1_ITEMS, D1_MEMBERSHIP, sampleMyWork } from '@/testing/sampleMyWork.js';

import { groupMyWorkByRepository } from './groupMyWorkByRepository.js';

const work = sampleMyWork(D1_ITEMS, D1_MEMBERSHIP, 'all');

test('a group per tracked repository in the tracking order, those without rows left out, then the untracked ones', () => {
    const grouped = groupMyWorkByRepository(work.groups, [
        'kedrzu/githq',
        'acme/empty',
        'kedrzu/skills',
        'sigma-clinic/portal',
        'sigma-clinic/api',
    ]);

    expect(grouped.map(group => [group.repository, group.rows.map(row => row.item.id)])).toEqual([
        ['kedrzu/githq', ['PR_15', 'I_12', 'I_9']],
        ['kedrzu/skills', ['I_31']],
        // Review requested first, then the assigned issue — reason order, not age.
        ['sigma-clinic/portal', ['PR_1203', 'I_1187']],
        ['sigma-clinic/api', ['PR_482', 'PR_477', 'I_463']],
        [null, ['PR_18842', 'PR_94']],
    ]);
});

test('every row of my work once, the nested pull request still under its issue, and the counts summing to the total', () => {
    const grouped = groupMyWorkByRepository(work.groups, ['sigma-clinic/portal']);

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
