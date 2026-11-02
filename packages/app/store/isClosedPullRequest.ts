import type { PullRequestItem } from './ItemTypes.js';

/**
 * Whether the pull request was closed without merging; `merged` is checked as well as `state`.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isClosedPullRequest(pr: PullRequestItem): boolean {
    return pr.state === 'CLOSED' && !pr.merged;
}
