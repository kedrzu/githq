/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { ListGrouping } from './groupEntries.js';
import { groupEntries } from './groupEntries.js';
import type { ListGroup } from './ListTypes.js';

interface Task {
    readonly id: string;
    readonly tags: readonly string[];
}

const BY_TAG: ListGrouping<Task> = {
    values: value => value.tags.map(tag => ({ key: tag, label: tag })),
    none: { key: '', label: 'No tag' },
    movable: true,
};

test('entries keep their order under each value; groups met come by label, the group without a value last', () => {
    const groups = groupEntries({
        entries: [task('a', []), task('b', ['zeta']), task('c', ['alpha']), task('d', ['zeta'])],
        getId: entry => entry.id,
        grouping: BY_TAG,
    });

    expect(summarize(groups)).toEqual([
        ['alpha', ['c']],
        ['zeta', ['b', 'd']],
        ['', ['a']],
    ]);
    expect(groups.every(group => group.droppable && group.arrived)).toBe(true);
});

test('an entry with two values is listed under both, under keys of its own', () => {
    const groups = groupEntries({ entries: [task('a', ['x', 'y'])], getId: entry => entry.id, grouping: BY_TAG });

    expect(groups.map(group => group.rows.map(row => [row.key, row.id]))).toEqual([[['x:a', 'a']], [['y:a', 'a']]]);
});

test('fixed groups come first in their order, also when empty; no group without a value when every entry has one', () => {
    const groups = groupEntries({
        entries: [task('a', ['done']), task('b', ['later'])],
        getId: entry => entry.id,
        grouping: {
            ...BY_TAG,
            fixed: [
                { key: 'todo', label: 'Todo' },
                { key: 'done', label: 'Done' },
            ],
        },
    });

    expect(summarize(groups)).toEqual([
        ['todo', []],
        ['done', ['a']],
        ['later', ['b']],
    ]);
});

function task(id: string, tags: readonly string[]): Task {
    return { id, tags };
}

function summarize(groups: readonly ListGroup<Task>[]) {
    return groups.map(group => [group.key, group.rows.map(row => row.id)]);
}
