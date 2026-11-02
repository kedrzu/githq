/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import { getStackStateFact } from './getStackStateFact.js';

function getText(openCount: number): string {
    return getStackStateFact({ state: { kind: 'ready', openCount }, lang: APP_LANGUAGE, getHeldText: () => '' }).text;
}

test('a ready stack reads "Ready" with one open pull request, "Both ready" with two, "All 3 ready" with three', () => {
    expect([getText(1), getText(2), getText(3)]).toEqual(['Ready', 'Both ready', 'All 3 ready']);
});
