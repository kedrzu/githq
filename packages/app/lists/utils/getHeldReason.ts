import { assertNever } from '@nzyme/utils/assertNever.js';

import type { StackBlocker } from '@/store/stacks/describeStack.js';

/** What holds a stack, as its held sentence names it: a draft, running checks, a review awaited, or that it blocks. */
export type HeldReason = 'checks' | 'draft' | 'other' | 'review';

/**
 * What a held sentence names about the pull request holding the stack (SP14) — the list's and the stack map's.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getHeldReason(blocker: StackBlocker): HeldReason {
    switch (blocker.kind) {
        case 'draft':
            return 'draft';
        case 'moving':
            return 'checks';
        case 'waiting':
            return blocker.waitingForReview ? 'review' : 'other';
        case 'broken':
        case 'ready':
        case 'merged':
        case 'closed':
            return 'other';
        default:
            return assertNever(blocker.kind);
    }
}
