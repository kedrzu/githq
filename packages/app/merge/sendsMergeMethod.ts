import type { PullRequestItem } from '@/store/ItemTypes.js';

import type { MergeRequest } from './MergeTypes.js';

/**
 * Whether a merge names its method: on a merge queue's branch the head commit goes alone, the queue having its own,
 * but for a merge past the rules, which leaves the queue out. A stack's top has another member's branch for its base,
 * so `first` is the first one going, whose base is the stack's.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function sendsMergeMethod(first: Pick<PullRequestItem, 'isMergeQueueEnabled'>, request: MergeRequest): boolean {
    return !first.isMergeQueueEnabled || request.bypassRules === true;
}
