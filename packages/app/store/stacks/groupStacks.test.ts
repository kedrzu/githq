/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { PullRequestItem } from '@/store/ItemTypes.js';
import { sampleIssue, samplePullRequest } from '@/testing/sampleItems.js';

import { groupStacks } from './groupStacks.js';

test('pull requests of one stack id form a stack ordered by position, whatever their state', () => {
    const third = member('PR_3', 'S_1', 3, { state: 'CLOSED' });
    const first = member('PR_1', 'S_1', 1, { state: 'MERGED', merged: true });
    const second = member('PR_2', 'S_1', 2);
    const other = member('PR_other', 'S_2', 1);

    const stacks = groupStacks([third, sampleIssue('I_1'), samplePullRequest('PR_plain'), first, other, second]);

    expect([...stacks.keys()]).toEqual(['S_1', 'S_2']);
    expect(stacks.get('S_1')).toEqual({ id: 'S_1', number: 7, size: 3, members: [first, second, third] });
    expect(stacks.get('S_2')?.members).toEqual([other]);
});

test('the size is the largest any member says, and covers a member placed beyond it', () => {
    const stale = member('PR_1', 'S_1', 1, {}, 2);
    const fresh = member('PR_2', 'S_1', 2, {}, 4);
    const beyond = member('PR_5', 'S_2', 5, {}, 3);

    const stacks = groupStacks([stale, fresh, beyond]);

    expect(stacks.get('S_1')?.size).toBe(4);
    expect(stacks.get('S_2')?.size).toBe(5);
});

function member(
    id: string,
    stackId: string,
    position: number,
    overrides: Partial<PullRequestItem> = {},
    size = 3,
): PullRequestItem {
    return { ...samplePullRequest(id), stack: { id: stackId, number: 7, size, position }, ...overrides };
}
