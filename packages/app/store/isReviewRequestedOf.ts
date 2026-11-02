import type { PullRequestItem } from './ItemTypes.js';

/**
 * Whether the pull request asks `login`'s own review — as a user, not through a team.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isReviewRequestedOf(pr: PullRequestItem, login: string): boolean {
    return pr.reviewRequests.some(request => request.kind === 'user' && request.login === login);
}
