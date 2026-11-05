import type { PullRequestReviewState } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { CircleCheck, CircleSlash, FileDiff, MessageSquare } from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';

import * as l from './getReviewVerdict.loc.js';

/** How a verdict is coloured, for a component's CSS to map. */
export type ReviewVerdictTone = 'approved' | 'changes' | 'quiet';

/** How a submitted review's verdict shows. */
export interface ReviewVerdict {
    readonly icon: LucideIcon;
    readonly tone: ReviewVerdictTone;
    readonly label: (typeof l)[keyof typeof l];
}

/**
 * How a submitted review's verdict shows: in the item's list of reviewers and in the conversation beside the diff.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getReviewVerdict(state: Exclude<PullRequestReviewState, 'PENDING'>): ReviewVerdict {
    switch (state) {
        case 'APPROVED':
            return { icon: CircleCheck, tone: 'approved', label: l.APPROVED };
        case 'CHANGES_REQUESTED':
            return { icon: FileDiff, tone: 'changes', label: l.CHANGES_REQUESTED };
        case 'COMMENTED':
            return { icon: MessageSquare, tone: 'quiet', label: l.COMMENTED };
        case 'DISMISSED':
            return { icon: CircleSlash, tone: 'quiet', label: l.DISMISSED };
        default:
            return assertNever(state);
    }
}
