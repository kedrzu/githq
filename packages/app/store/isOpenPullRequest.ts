import type { PullRequestItem } from './ItemTypes.js';

/**
 * Whether the pull request is open — neither merged nor closed; `merged` is checked as well as `state`.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isOpenPullRequest(pr: PullRequestItem): boolean {
    return pr.state === 'OPEN' && !pr.merged;
}
