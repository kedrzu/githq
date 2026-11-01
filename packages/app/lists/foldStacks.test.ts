/// <reference types="bun" />
import { assertValue } from '@nzyme/utils/assert.js';
import { expect, test } from 'bun:test';

import type { Item, PullRequestItem } from '@/store/ItemTypes.js';
import type { StackDescription } from '@/store/stacks/describeStack.js';
import type { PullRequestStack } from '@/store/stacks/groupStacks.js';
import { groupStacks } from '@/store/stacks/groupStacks.js';
import { sampleIssue } from '@/testing/sampleItems.js';
import { sampleStack } from '@/testing/sampleStacks.js';

import { foldStacks } from './foldStacks.js';
import type { ListGroup } from './ListTypes.js';

const ISSUE = sampleIssue('I_1');

test('the rows of a stack in a group become one entry in place of the best sorted, its pull requests in stack order', () => {
    const stack = sampleStack({
        id: 'S_1',
        number: 11,
        members: [{}, { reviewDecision: 'REVIEW_REQUIRED', mergeStateStatus: 'BLOCKED' }, {}],
    });
    const [first, second, third] = [member(stack, 0), member(stack, 1), member(stack, 2)] as const;
    const described: string[] = [];
    const [group] = fold([toGroup('todo', [second, ISSUE, first, third])], stack, described);

    expect(group?.rows.map(row => row.id)).toEqual(['stack:S_1', ISSUE.id]);
    const [entry] = group?.rows ?? [];
    expect(entry?.key).toBe('todo:stack:S_1');
    expect(entry?.nested.map(nested => nested.key)).toEqual([
        `todo:${first.id}`,
        `todo:${second.id}`,
        `todo:${third.id}`,
    ]);
    // Enter opens the first open one not yet approved (D9).
    expect(entry?.stack?.open).toBe(second.id);
    expect(entry?.value).toBe(second);
    expect(entry?.stack?.pullRequests).toEqual([first, second, third]);
    expect(described).toEqual(['S_1']);
});

test('a stack spread over groups has an entry in each, of its pull requests there; one alone in a group stays a row', () => {
    const stack = sampleStack({ id: 'S_1', number: 11, members: [{}, {}, {}, {}, {}] });
    const [a, b, c, d, e] = [
        member(stack, 0),
        member(stack, 1),
        member(stack, 2),
        member(stack, 3),
        member(stack, 4),
    ] as const;
    const described: string[] = [];
    const groups = fold(
        [toGroup('bug', [a, c]), toGroup('feature', [ISSUE, d, b]), toGroup('docs', [e])],
        stack,
        described,
    );

    expect(groups.map(group => group.rows.map(row => row.id))).toEqual([
        ['stack:S_1'],
        [ISSUE.id, 'stack:S_1'],
        [e.id],
    ]);
    expect(groups[1]?.rows[1]?.nested.map(nested => nested.id)).toEqual([b.id, d.id]);
    // Described once, the whole stack.
    expect(described).toEqual(['S_1']);
});

test('a stack with one open pull request left stays plain rows', () => {
    const stack = sampleStack({
        id: 'S_1',
        number: 11,
        members: [{ state: 'MERGED', merged: true }, { state: 'MERGED', merged: true }, {}],
    });

    const [group] = fold([toGroup('all', stack)], stack, []);

    expect(group?.rows.map(row => row.stack ?? null)).toEqual([null, null, null]);
});

test('a group without two pull requests of one stack is given back as it was', () => {
    const groups = [toGroup('todo', [ISSUE])];

    expect(fold(groups, [], [])[0]).toBe(groups[0]);
});

function fold(groups: ListGroup<Item>[], items: readonly Item[], described: string[]): ListGroup<Item>[] {
    return foldStacks({
        groups,
        getPullRequest: item => (item.kind === 'pullRequest' ? item : null),
        stacks: groupStacks(items),
        describe: stack => {
            described.push(stack.id);
            return describe(stack);
        },
    });
}

function describe(stack: PullRequestStack): StackDescription {
    return {
        name: { title: stack.members[0]?.title ?? '', issueId: null },
        size: stack.size,
        held: stack.members.length,
        pips: [],
        state: { kind: 'ready', openCount: stack.members.length },
        landed: 0,
        updatedAt: '',
    };
}

function toGroup(key: string, items: readonly Item[]): ListGroup<Item> {
    return {
        key,
        label: key,
        arrived: true,
        droppable: false,
        rows: items.map(item => ({ key: `${key}:${item.id}`, id: item.id, value: item, nested: [] })),
    };
}

function member(stack: readonly PullRequestItem[], index: number): PullRequestItem {
    return assertValue(stack[index]);
}
