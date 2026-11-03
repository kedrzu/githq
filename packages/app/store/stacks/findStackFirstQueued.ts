import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';
import type { Item, PullRequestItem } from '@/store/ItemTypes.js';

/**
 * The stack's first open member in the merge queue, the only one GitHub takes out of it, whoever asks (merging D11): as
 * the copy's rows hold them, `undefined` when they hold none.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function findStackFirstQueued(stackId: string, items: readonly Item[]): PullRequestItem | undefined {
    let first: PullRequestItem | undefined;
    for (const item of items) {
        if (
            item.kind === 'pullRequest' &&
            item.stack?.id === stackId &&
            isOpenPullRequest(item) &&
            item.mergeQueueEntry &&
            (first?.stack == null || item.stack.position < first.stack.position)
        ) {
            first = item;
        }
    }

    return first;
}
