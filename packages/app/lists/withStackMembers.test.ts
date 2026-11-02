/// <reference types="bun" />
import { assertValue } from '@nzyme/utils/assert.js';
import { expect, test } from 'bun:test';

import type { Item, PullRequestItem } from '@/store/ItemTypes.js';
import { sampleIssue } from '@/testing/sampleItems.js';
import { sampleStack } from '@/testing/sampleStacks.js';

import { withStackMembers } from './withStackMembers.js';

const ISSUE = sampleIssue('I_1');

test('a stack any open pull request of which matches brings its other open ones, in the order of all', () => {
    const stack = sampleStack({ id: 'S_1', number: 11, members: [{ state: 'MERGED', merged: true }, {}, {}] });
    const [merged, first, second] = [member(stack, 0), member(stack, 1), member(stack, 2)] as const;
    const other = member(sampleStack({ id: 'S_2', number: 12, members: [{}, {}] }), 0);

    const shown = withStackMembers({
        matched: [ISSUE, first],
        all: [second, ISSUE, merged, first, other],
        getPullRequest,
    });

    expect(shown.map(item => item.id)).toEqual([second.id, ISSUE.id, first.id]);
});

test('nothing added gives back what matched', () => {
    const lone = member(sampleStack({ id: 'S_1', number: 11, members: [{}] }), 0);
    const matched: Item[] = [ISSUE, lone];

    expect(withStackMembers({ matched, all: matched, getPullRequest })).toBe(matched);
});

function getPullRequest(item: Item) {
    return item.kind === 'pullRequest' ? item : null;
}

function member(stack: readonly PullRequestItem[], index: number): PullRequestItem {
    return assertValue(stack[index]);
}
