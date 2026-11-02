import type { Translator } from '@nzyme/i18n/Translator.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { CircleCheck, CircleDashed, Eye, GitCompareArrows, GitMerge, GitPullRequestClosed } from 'lucide-vue-next';

import type { StackHeldState, StackState } from '@/store/stacks/describeStack.js';

import type { StackStateFact } from '../useStackFacts.js';
import { getBlockerLook } from './getBlockerLook.js';
import * as l from './getStackStateFact.loc.js';

/** The stack's state to put in words, and how the caller words what holds it. */
export interface GetStackStateFactParams {
    readonly state: StackState;
    readonly t: Translator;
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
export function getStackStateFact({ state, t, getHeldText }: GetStackStateFactParams): StackStateFact {
    switch (state.kind) {
        case 'ready':
            return {
                icon: CircleCheck,
                tone: 'success',
                text: state.openCount === 2 ? t(l.bothReady) : t(l.allReady, { count: state.openCount }),
            };
        case 'held':
            return { ...getBlockerLook(state.blocker.kind), text: getHeldText(state) };
        case 'needsRebase':
            return { icon: GitCompareArrows, tone: 'warning', text: t(l.needsRebase) };
        case 'closedInside':
            return {
                icon: GitPullRequestClosed,
                tone: 'danger',
                text: t(l.closedInside, { number: state.closedNumber, stuck: state.stuckCount }),
            };
        case 'closed':
            return { icon: GitPullRequestClosed, tone: 'dim', text: t(l.closed) };
        case 'incomplete':
            return { icon: CircleDashed, tone: 'dim', text: t(l.incomplete) };
        case 'merged':
            return { icon: GitMerge, tone: 'done', text: t(l.merged) };
        case 'reviewRequested':
            return {
                icon: Eye,
                tone: 'muted',
                text: t(l.reviewRequested, {
                    requested: state.requestedCount,
                    open: state.openCount,
                    ready: state.readyCount,
                }),
            };
        default:
            return assertNever(state);
    }
}
