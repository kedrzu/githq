import { assertNever } from '@nzyme/utils/assertNever.js';
import { CircleX, GitPullRequestDraft, Hourglass, Loader } from 'lucide-vue-next';

import type { StackPullRequestPipKind } from '@/store/stacks/describeStack.js';

import type { StackLook } from '../useStackFacts.js';

/**
 * A held stack reads in the colour of what holds it (SP14): red when broken, amber when moving, grey otherwise.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getBlockerLook(kind: StackPullRequestPipKind): StackLook {
    switch (kind) {
        case 'broken':
            return { icon: CircleX, tone: 'danger' };
        case 'moving':
            return { icon: Loader, tone: 'warning' };
        case 'draft':
            return { icon: GitPullRequestDraft, tone: 'dim' };
        case 'waiting':
        case 'ready':
        case 'merged':
        case 'closed':
            return { icon: Hourglass, tone: 'muted' };
        default:
            return assertNever(kind);
    }
}
