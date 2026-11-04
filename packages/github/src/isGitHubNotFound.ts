import { GitHubApiError } from './GitHubApiError.js';

/**
 * Whether GitHub answered that what was asked for isn't there, or isn't visible to the user.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isGitHubNotFound(error: unknown) {
    return error instanceof GitHubApiError && error.errors.some(entry => entry.type === 'NOT_FOUND');
}
