import type { PullRequestItem } from '@/store/ItemTypes.js';

/**
 * GitHub's editor of a pull request's conflicts, where they are resolved (merging PM19): the merge panel's way
 * forward when it has conflicts.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getConflictEditorUrl(pr: Pick<PullRequestItem, 'url'>): string {
    return `${pr.url}/conflicts`;
}
