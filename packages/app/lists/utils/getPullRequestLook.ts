import { assertNever } from '@nzyme/utils/assertNever.js';
import { CircleCheck, GitMerge, GitPullRequestClosed } from 'lucide-vue-next';

import type { StackPullRequestPipKind } from '@/store/stacks/describeStack.js';

import type { StackLook } from '../useStackFacts.js';
import { getBlockerLook } from './getBlockerLook.js';

/**
 * A pull request in its own state, as its pip draws it (D6): the icon and colour its line in an expanded card and its
 * row in the stack map show.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getPullRequestLook(kind: StackPullRequestPipKind): StackLook {
    switch (kind) {
        case 'ready':
            return { icon: CircleCheck, tone: 'success' };
        case 'merged':
            return { icon: GitMerge, tone: 'done' };
        case 'closed':
            return { icon: GitPullRequestClosed, tone: 'danger' };
        case 'broken':
        case 'moving':
        case 'draft':
        case 'waiting':
            return getBlockerLook(kind);
        default:
            return assertNever(kind);
    }
}
