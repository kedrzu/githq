import { getPullRequestStanding } from '@/store/getPullRequestStanding.js';

import type { StackBlocker, StackPullRequestPip } from './describeStack.js';

/**
 * The member holding a stack back, as what holds it is named (SP14).
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function toStackBlocker(pip: StackPullRequestPip): StackBlocker {
    return {
        number: pip.pullRequest.number,
        kind: pip.kind,
        waitingForReview: getPullRequestStanding(pip.pullRequest).waitingForReview,
    };
}
