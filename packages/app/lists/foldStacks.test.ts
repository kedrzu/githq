/// <reference types="bun" />
import { assertValue } from '@nzyme/utils/assert.js';
import { expect, test } from 'bun:test';

import type { Item, PullRequestItem } from '@/store/ItemTypes.js';
import { describeStack } from '@/store/stacks/describeStack.js';
import { groupStacks } from '@/store/stacks/groupStacks.js';
import { sampleIssue } from '@/testing/sampleItems.js';
import { sampleStack } from '@/testing/sampleStacks.js';

import { foldStacks } from './foldStacks.js';
import type { ListGroup } from './ListTypes.js';

const ISSUE = sampleIssue('I_1');
const FAILING = { state: 'FAILURE', passing: 11, failing: 1, pending: 0 } as const;

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

test("each group's entry of a spread stack is a share: its own pull requests alone, how many, and how it stands", () => {
    // SP24: the third fails its checks and holds back the fourth.
    const stack = sampleStack({
        id: 'S_1',
        number: 1204,
        members: [{}, {}, { mergeStateStatus: 'BLOCKED', checks: FAILING }, { reviewDecision: 'REVIEW_REQUIRED' }],
    });
    const [a, b, c, d] = [member(stack, 0), member(stack, 1), member(stack, 2), member(stack, 3)] as const;

    const [calendar, frontend, none] = fold(
        [toGroup('calendar', [b, a]), toGroup('frontend', [c, b]), toGroup('none', [ISSUE, d])],
        stack,
        [],
    );

    const ready = calendar?.rows[0];
    expect(ready?.nested.map(nested => nested.id)).toEqual([a.id, b.id]);
    expect(ready?.stack?.pullRequests).toEqual([a, b]);
    expect(ready?.stack?.share).toEqual({ count: 2, state: { kind: 'ready', count: 2 } });
    // Enter opens one of the share: never a pull request of another group.
    expect(ready?.stack?.open).toBe(a.id);

    const held = frontend?.rows[0];
    expect(held?.nested.map(nested => nested.id)).toEqual([b.id, c.id]);
    expect(held?.stack?.share).toEqual({
        count: 2,
        state: { kind: 'held', blocker: { number: c.number, kind: 'broken', waitingForReview: false } },
    });
    expect(held?.stack?.open).toBe(b.id);

    // Ready itself, but held back by the third: alone in its group, a row marked with its stack.
    expect(none?.rows.map(row => row.id)).toEqual([ISSUE.id, d.id]);
    expect(none?.rows[0]?.stackMarker).toBeUndefined();
    expect(none?.rows[1]?.stack ?? null).toBeNull();
    expect(none?.rows[1]?.stackMarker?.size).toBe(4);
});

test('an entry holding every open pull request of its stack is the whole stack, not a share', () => {
    const stack = sampleStack({ id: 'S_1', number: 11, members: [{ state: 'MERGED', merged: true }, {}, {}] });

    const [group] = fold([toGroup('all', stack)], stack, []);

    expect(group?.rows.map(row => row.id)).toEqual([member(stack, 0).id, 'stack:S_1']);
    expect(group?.rows[1]?.stack?.share).toBeNull();
    // Merged, it is no part of the stack's open work: no marker.
    expect(group?.rows[0]?.stackMarker).toBeUndefined();
});

test("a share after the stack's blocker is held by it, though its own pull requests can merge", () => {
    const stack = sampleStack({
        id: 'S_1',
        number: 11,
        members: [{ reviewDecision: 'REVIEW_REQUIRED', mergeStateStatus: 'BLOCKED' }, {}, {}],
    });

    const [, later] = fold([toGroup('first', [member(stack, 0)]), toGroup('later', stack.slice(1))], stack, []);

    expect(later?.rows[0]?.stack?.share).toEqual({
        count: 2,
        state: { kind: 'held', blocker: { number: 11, kind: 'waiting', waitingForReview: true } },
    });
});

test('a stack with one open pull request left stays plain rows, the open one marked with its stack (SP13)', () => {
    const stack = sampleStack({
        id: 'S_1',
        number: 11,
        members: [{ state: 'MERGED', merged: true }, { state: 'MERGED', merged: true }, {}],
    });

    const [group] = fold([toGroup('all', stack)], stack, []);

    expect(group?.rows.map(row => row.stack ?? null)).toEqual([null, null, null]);
    expect(group?.rows.map(row => row.stackMarker?.size ?? null)).toEqual([null, null, 3]);
});

test('only open pull requests fold: merged and closed ones of a list that shows them stay plain rows', () => {
    const stack = sampleStack({
        id: 'S_1',
        number: 11,
        members: [{ state: 'MERGED', merged: true }, { state: 'MERGED', merged: true }, {}, { state: 'CLOSED' }, {}],
    });
    const [first, second, third, fourth, fifth] = [
        member(stack, 0),
        member(stack, 1),
        member(stack, 2),
        member(stack, 3),
        member(stack, 4),
    ] as const;

    const [both, closed] = fold(
        [toGroup('both', [first, third, fourth, fifth]), toGroup('closed', [first, second, fourth])],
        stack,
        [],
    );

    expect(both?.rows.map(row => row.id)).toEqual([first.id, 'stack:S_1', fourth.id]);
    const entry = both?.rows[1];
    expect(entry?.nested.map(nested => nested.id)).toEqual([third.id, fifth.id]);
    expect(entry?.stack?.pullRequests).toEqual([third, fifth]);
    // Landed and closed alone: no entry speaking for open pull requests the list does not show.
    expect(closed?.rows.map(row => row.id)).toEqual([first.id, second.id, fourth.id]);
});

test('a group without two pull requests of one stack is given back as it was', () => {
    const groups = [toGroup('todo', [ISSUE])];

    expect(fold(groups, [], [])[0]).toBe(groups[0]);
});

test('under a filter a stack shows whole where any of it matches, in place of the best sorted match, the others unmatched', () => {
    const stack = sampleStack({ id: 'S_1', number: 11, members: [{}, {}, {}] });
    const [a, b, c] = [member(stack, 0), member(stack, 1), member(stack, 2)] as const;
    const other = sampleStack({ id: 'S_2', number: 12, members: [{}, {}] });
    const [d, e] = [member(other, 0), member(other, 1)] as const;

    const [todo, done] = fold(
        // `a` sorts first but does not match: the entry goes where `b`, the first match, is.
        [toGroup('todo', [a, ISSUE, b, d, e]), toGroup('done', [c])],
        [...stack, ...other],
        [],
        new Set([ISSUE.id, b.id]),
    );

    expect(todo?.rows.map(row => row.id)).toEqual([ISSUE.id, 'stack:S_1']);
    const entry = todo?.rows[1];
    expect(entry?.nested.map(nested => nested.id)).toEqual([a.id, b.id]);
    expect([...(entry?.stack?.unmatched ?? [])]).toEqual([a.id]);
    // No match in the group: nothing of the stack shows there.
    expect(done?.rows).toEqual([]);
});

test('under a filter a lone matching pull request of a stack stays a marked row, and an entry all matching has none unmatched', () => {
    const stack = sampleStack({ id: 'S_1', number: 11, members: [{}, {}, {}] });
    const [a, b, c] = [member(stack, 0), member(stack, 1), member(stack, 2)] as const;

    const [one, both] = fold([toGroup('one', [a]), toGroup('both', [b, c])], stack, [], new Set([a.id, b.id, c.id]));

    expect(one?.rows.map(row => row.stackMarker?.size ?? null)).toEqual([3]);
    expect(both?.rows[0]?.stack?.unmatched).toBeNull();
});

function fold(
    groups: ListGroup<Item>[],
    items: readonly Item[],
    described: string[],
    matched: ReadonlySet<string> | null = null,
): ListGroup<Item>[] {
    return foldStacks({
        matched,
        groups,
        getPullRequest: item => (item.kind === 'pullRequest' ? item : null),
        stacks: groupStacks(items),
        describe: stack => {
            described.push(stack.id);
            return describeStack({ stack, viewerLogin: 'viewer', getItem: () => undefined });
        },
    });
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
