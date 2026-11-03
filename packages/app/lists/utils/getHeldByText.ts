import type { Language } from '@nzyme/i18n/Language.js';
import { translateToString } from '@nzyme/i18n/translateToString.js';
import type { Translation } from '@nzyme/i18n-core';
import { assertNever } from '@nzyme/utils/assertNever.js';

import type { StackBlocker } from '@/store/stacks/describeStack.js';

import { getHeldReason } from './getHeldReason.js';
import * as l from './getHeldByText.loc.js';

/** What the words for what holds a stack name. */
export interface HeldByTextParams {
    readonly number: number;
}

/** What holds a stack, to put in words. */
export interface GetHeldByTextParams {
    readonly blocker: StackBlocker;
    readonly lang: Language;
    /** The words where nothing more specific can be said: "#1206 blocks", "#1206 holds the rest". */
    readonly otherwise: Translation<HeldByTextParams>;
}

/**
 * What holds a stack, named without the stack's count: "#1206 is a draft", "#1216 checks running", "#97 waiting for
 * review" (SP24, SP45, SP49).
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getHeldByText({ blocker, lang, otherwise }: GetHeldByTextParams): string {
    const { number } = blocker;
    const reason = getHeldReason(blocker);
    switch (reason) {
        case 'draft':
            return translateToString(l.draft, lang, { number });
        case 'checks':
            return translateToString(l.checks, lang, { number });
        case 'review':
            return translateToString(l.review, lang, { number });
        case 'other':
            return translateToString(otherwise, lang, { number });
        default:
            return assertNever(reason);
    }
}
