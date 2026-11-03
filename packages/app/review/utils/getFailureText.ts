import { GitHubApiError } from '@githq/github/GitHubApiError.js';

/**
 * What to tell the user a request failed with: GitHub's own words (D35), without what the requesters put before them.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getFailureText(error: Error) {
    if (!(error instanceof GitHubApiError)) {
        return error.message;
    }

    return error.githubMessage ?? (error.errors.map(entry => entry.message).join('; ') || error.message);
}
