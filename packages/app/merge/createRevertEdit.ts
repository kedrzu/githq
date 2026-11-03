import type { Edit } from '@/edits/EditTypes.js';
import { base, dropped, UNCHANGED } from '@/edits/createItemEdits.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';

import type { RevertedPullRequest } from './MergeTypes.js';

/**
 * Opens a new pull request reverting a merged one (merging D16). The merged one doesn't change, so nothing is drawn;
 * `onOpened` hears of the new one, as an edit's answer has no place for it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createRevertEdit(item: PullRequestItem, onOpened: (opened: RevertedPullRequest) => void): Edit {
    return {
        ...base(item, { kind: 'reverted' }),
        optimistic: UNCHANGED,
        send: async ({ sdk }) => {
            const opened = (await sdk.RevertPullRequest({ pullRequestId: item.id })).revertPullRequest
                ?.revertPullRequest;
            if (!opened) {
                return dropped();
            }

            onOpened({ number: opened.number, url: opened.url });
            return { kind: 'confirmed', layer: UNCHANGED };
        },
    };
}
