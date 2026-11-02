import type { PullRequestItem } from './ItemTypes.js';

/**
 * Whether the pull request is merged; `state` is checked as well as `merged`.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isMergedPullRequest(pr: PullRequestItem): boolean {
    return pr.merged || pr.state === 'MERGED';
}
