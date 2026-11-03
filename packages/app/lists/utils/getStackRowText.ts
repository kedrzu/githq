import type { Language } from '@nzyme/i18n/Language.js';
import { translateToString } from '@nzyme/i18n/translateToString.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import { getPullRequestStanding } from '@/store/getPullRequestStanding.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import type { StackPullRequestPipKind } from '@/store/stacks/describeStack.js';

import * as l from './getStackRowText.loc.js';

/** A stack's pull request, to put its own state in words. */
export interface GetStackRowTextParams {
    readonly kind: StackPullRequestPipKind;
    readonly pullRequest: PullRequestItem;
    readonly lang: Language;
}

/**
 * A stack's pull request's own state in words, on its row in a stack's map and in the merge panel: "Ready", "2 checks
 * failing", "Waiting for review" (SP30, SP31, SP40). The tone is each row's own.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getStackRowText({ kind, pullRequest, lang }: GetStackRowTextParams): string {
    const standing = getPullRequestStanding(pullRequest);
    switch (kind) {
        case 'draft':
            return translateToString(l.draft, lang);
        case 'ready':
            return translateToString(l.ready, lang);
        case 'broken':
            if (standing.checksFailing) {
                return standing.failingChecks > 0
                    ? translateToString(l.checksFailing, lang, { count: standing.failingChecks })
                    : translateToString(l.checksFailingUncounted, lang);
            }

            return translateToString(standing.changesRequested ? l.changesRequested : l.conflicts, lang);
        case 'moving':
            // Moving without running checks: the stack needs a rebase (D21).
            return translateToString(standing.checksRunning ? l.checksRunning : l.needsRebase, lang);
        case 'waiting':
            return translateToString(standing.waitingForReview ? l.waitingForReview : l.cannotMergeYet, lang);
        case 'merged':
            return translateToString(l.merged, lang);
        case 'closed':
            return translateToString(l.closed, lang);
        case 'merging':
            return translateToString(l.beingMerged, lang);
        default:
            return assertNever(kind);
    }
}
