import type { Language } from '@nzyme/i18n/Language.js';
import { translateToString } from '@nzyme/i18n/translateToString.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { CircleCheck, CircleDashed, Eye, GitCompareArrows, GitMerge, GitPullRequestClosed } from 'lucide-vue-next';

import type { StackHeldState, StackState } from '@/store/stacks/describeStack.js';

import type { StackStateFact } from '../useStackFacts.js';
import { getBlockerLook } from './getBlockerLook.js';
import * as l from './getStackStateFact.loc.js';

/** The stack's state to put in words, and how the caller words what holds it. */
export interface GetStackStateFactParams {
    readonly state: StackState;
    readonly lang: Language;
    /**
     * What holds it in words: the list's sentence counts the ready ones (SP14), the stack map's says what the blocker
     * stops (SP30, SP31).
     */
    readonly getHeldText: (state: StackHeldState) => string;
}

/**
 * A stack's state in words, its icon and colour (SP14) — the list's entry and the stack map's verdict.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getStackStateFact({ state, lang, getHeldText }: GetStackStateFactParams): StackStateFact {
    switch (state.kind) {
        case 'ready':
            return {
                icon: CircleCheck,
                tone: 'success',
                text:
                    state.openCount === 2
                        ? translateToString(l.bothReady, lang)
                        : translateToString(l.allReady, lang, { count: state.openCount }),
            };
        case 'held':
            return { ...getBlockerLook(state.blocker.kind), text: getHeldText(state) };
        case 'needsRebase':
            return { icon: GitCompareArrows, tone: 'warning', text: translateToString(l.needsRebase, lang) };
        case 'closedInside':
            return {
                icon: GitPullRequestClosed,
                tone: 'danger',
                text: translateToString(l.closedInside, lang, { number: state.closedNumber, stuck: state.stuckCount }),
            };
        case 'closed':
            return { icon: GitPullRequestClosed, tone: 'dim', text: translateToString(l.closed, lang) };
        case 'incomplete':
            return { icon: CircleDashed, tone: 'dim', text: translateToString(l.incomplete, lang) };
        case 'merged':
            return { icon: GitMerge, tone: 'done', text: translateToString(l.merged, lang) };
        case 'reviewRequested':
            return {
                icon: Eye,
                tone: 'muted',
                text: translateToString(l.reviewRequested, lang, {
                    requested: state.requestedCount,
                    open: state.openCount,
                    ready: state.readyCount,
                }),
            };
        default:
            return assertNever(state);
    }
}
