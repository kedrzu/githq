/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { matchTypedRef } from './matchTypedRef.js';

const REFS = ['main', 'sofiab/tokens', 'chore/deploy-workflow', 'v0.1.0'];

test('nothing typed means every ref', () => {
    expect(matchTypedRef('  ', REFS)).toBeNull();
});

test('a ref named exactly is that ref, before any other holding it', () => {
    expect(matchTypedRef('main', [...REFS, 'main-2'].toReversed())).toBe('main');
});

test('otherwise the first seen ref holding what was typed, in any case', () => {
    expect(matchTypedRef('TOK', REFS)).toBe('sofiab/tokens');
    expect(matchTypedRef('o', REFS)).toBe('sofiab/tokens');
});

test('a ref not seen is taken as typed', () => {
    expect(matchTypedRef(' release/2 ', REFS)).toBe('release/2');
});
