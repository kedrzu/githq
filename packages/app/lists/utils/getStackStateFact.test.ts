/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import type { StackState } from '@/store/stacks/describeStack.js';

import { getStackStateFact } from './getStackStateFact.js';

function getText(openCount: number): string {
    return getStackStateFact({ state: { kind: 'ready', openCount }, lang: APP_LANGUAGE, getHeldText: () => '' }).text;
}

test('a ready stack reads "Ready" with one open pull request, "Both ready" with two, "All 3 ready" with three', () => {
    expect([getText(1), getText(2), getText(3)]).toEqual(['Ready', 'Both ready', 'All 3 ready']);
});

test('a stack being merged says how many are going and that none is merged yet; merged, how many landed', () => {
    expect(text({ kind: 'merging', goingCount: 3 })).toBe('Being merged · 3 going · not merged yet');
    expect(text({ kind: 'merged', count: 3 })).toBe('Merged · all 3 landed');
    expect(text({ kind: 'merged', count: 1 })).toBe('Merged');
});

function text(state: StackState): string {
    return getStackStateFact({ state, lang: APP_LANGUAGE, getHeldText: () => '' }).text;
}
