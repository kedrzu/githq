import { GitHubApiError } from '@githq/github/GitHubApiError.js';

import type { EditFailureReason } from './EditTypes.js';

/**
 * Why an edit that threw failed: GitHub's error — a GraphQL error's message, else GitHub's own words of a REST
 * refusal — or no answer at all.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toEditFailureReason(error: unknown): EditFailureReason {
    if (!(error instanceof GitHubApiError)) {
        return { kind: 'offline' };
    }

    if (error.errors.some(entry => entry.type === 'NOT_FOUND')) {
        return { kind: 'missing' };
    }

    return { kind: 'refused', message: error.errors[0]?.message ?? error.githubMessage ?? error.message };
}
