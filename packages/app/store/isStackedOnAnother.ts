import type { PullRequestItem } from './ItemTypes.js';

/**
 * Whether the pull request sits above another in its GitHub stack: GitHub merges it only together with every open one
 * below it (stacked PRs D11), which githq does not offer yet — position 1, the closest to the base, merges alone.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isStackedOnAnother(pr: PullRequestItem): boolean {
    return pr.stack !== null && pr.stack.position > 1;
}
