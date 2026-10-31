/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { followSelection } from './followSelection.js';

test('the selection stays on its item when the list reorders and grows around it', () => {
    expect(followSelection(['a', 'b', 'c'], ['x', 'c', 'b', 'a'], 'b')).toBe('b');
});

test('a selected item that disappears hands the selection to the next one that is still there', () => {
    expect(followSelection(['a', 'b', 'c', 'd'], ['a', 'd'], 'b')).toBe('d');
});

test('the last item disappearing hands the selection back to the one before it, not to the top', () => {
    expect(followSelection(['a', 'b', 'c'], ['a', 'b'], 'c')).toBe('b');
});

test('a list emptied, or never selected in, has no selection', () => {
    expect(followSelection(['a'], [], 'a')).toBeNull();
    expect(followSelection(['a'], ['a'], null)).toBeNull();
});
