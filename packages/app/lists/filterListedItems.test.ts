import { expect, test } from 'bun:test';

import { filterListedItems } from './filterListedItems.js';

const LISTED = {
    all: ['a', 'draft1', 'p1', 'p2', 'draft2', 'draft3', 'b'],
    steps: ['a', 'draft1', 'p1', 'draft2', 'draft3', 'b'],
    stepOf: new Map([['p2', 'p1']]),
    around: { previous: 'draft1', next: 'draft2' },
};

test('what is left out goes from every field, and a neighbour left out gives way to the next step on its side', () => {
    const kept = filterListedItems(LISTED, id => !id.startsWith('draft'));

    expect(kept.all).toEqual(['a', 'p1', 'p2', 'b']);
    expect(kept.steps).toEqual(['a', 'p1', 'b']);
    expect(kept.stepOf).toEqual(LISTED.stepOf);
    expect(kept.around).toEqual({ previous: 'a', next: 'b' });
});

test('a neighbour left out with nothing beyond it is none, and no cursor stays none', () => {
    const steps = ['a', 'draft'];
    const keep = (id: string) => id !== 'draft';

    expect(filterListedItems({ ...LISTED, steps, around: { previous: null, next: 'draft' } }, keep).around).toEqual({
        previous: null,
        next: null,
    });
    expect(filterListedItems({ ...LISTED, steps, around: null }, keep).around).toBeNull();
});
