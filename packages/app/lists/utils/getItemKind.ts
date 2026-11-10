import { CircleCheck, CircleDot, CircleSlash } from 'lucide-vue-next';

import type { IssueItem, PullRequestItem } from '@/store/ItemTypes.js';

import { getPullRequestKind } from './getPullRequestKind.js';
import type { PullRequestKind } from './getPullRequestKind.js';

/** What an item's icon is drawn from: its kind and state. */
export type ItemKindState =
    | Pick<IssueItem, 'kind' | 'state' | 'stateReason'>
    | Pick<PullRequestItem, 'isDraft' | 'kind' | 'merged' | 'state'>;

/**
 * The icon an issue or pull request is drawn with, in GitHub's colour: an open issue, one closed as completed or as
 * not planned, and a pull request as {@link getPullRequestKind} draws it — a list's row, a reference suggested in a
 * comment.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getItemKind(item: ItemKindState): PullRequestKind {
    if (item.kind === 'pullRequest') {
        return getPullRequestKind(item);
    }

    if (item.state === 'OPEN') {
        return { icon: CircleDot, tone: 'open' };
    }

    return item.stateReason === 'COMPLETED' || item.stateReason === null
        ? { icon: CircleCheck, tone: 'done' }
        : { icon: CircleSlash, tone: 'draft' };
}
