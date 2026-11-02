/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { sampleListStack, sampleStack } from '@/testing/sampleStacks.js';

import { getSelectionSpan } from './getSelectionSpan.js';
import type { ListGroup, ListRow } from './ListTypes.js';

test("SP28: a stack's entry counts once, whole or half selected; the rest are rows, each once", () => {
    const groups = [
        group('a', [stackRow('S_1', 4), row('r1'), stackRow('S_2', 3)]),
        // The same item in a second group (an issue with two labels) is one row.
        group('b', [row('r1'), stackRow('S_3', 3), row('r2')]),
    ];

    // S_1 and S_2 whole, a row, and one pull request of S_3.
    const whole = ['PR_S_1_1', 'PR_S_1_2', 'PR_S_1_3', 'PR_S_1_4', 'PR_S_2_1', 'PR_S_2_2', 'PR_S_2_3'];
    const span = getSelectionSpan(groups, [...whole, 'r1', 'PR_S_3_2']);

    expect(span).toEqual({ entries: 3, rows: 1 });
});

test("the stacks' entries nested under a row (my work's, D12) count as entries; the row itself as a row", () => {
    const issue: ListRow<string> = { ...row('i1'), stacks: [stackRow('S_1', 2), stackRow('S_2', 2)] };

    expect(getSelectionSpan([group('a', [issue])], ['i1', 'PR_S_1_2'])).toEqual({ entries: 1, rows: 1 });
});

test('without a stack among them, every selected item is a row', () => {
    expect(getSelectionSpan([group('a', [row('r1'), row('r2')])], ['r1', 'r2'])).toEqual({ entries: 0, rows: 2 });
});

function group(key: string, rows: readonly ListRow<string>[]): ListGroup<string> {
    return { key, label: key, arrived: true, rows, droppable: false };
}

function row(id: string): ListRow<string> {
    return { key: id, id, value: id, nested: [] };
}

/** A stack's entry of `size` pull requests, `PR_<stackId>_1` on. */
function stackRow(stackId: string, size: number): ListRow<string> {
    const members = sampleStack({ id: stackId, number: 1, members: Array.from({ length: size }, () => ({})) });
    const nested = members.map(member => ({ key: `${stackId}:${member.id}`, id: member.id, value: member.id }));
    const key = `stack:${stackId}`;
    return { key, id: key, value: stackId, nested, stack: sampleListStack(members) };
}
