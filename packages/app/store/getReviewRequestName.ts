import type { ItemDetailReviewRequest } from './ItemDetailTypes.js';

/**
 * Whom a review is asked of, by name: the person's login, or the team's name.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getReviewRequestName(request: ItemDetailReviewRequest) {
    return request.kind === 'user' ? request.user.login : request.name;
}
