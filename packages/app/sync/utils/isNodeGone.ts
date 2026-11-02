import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';

/**
 * Whether a node a `nodes(ids:)` answer did not give is gone, from the errors at it: `NOT_FOUND` at the node itself,
 * or no error at all. A node failing otherwise (hidden by an organisation's restrictions) is not — its kept copy
 * stays.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isNodeGone(nodeErrors: readonly GitHubGraphQLErrorEntry[]) {
    return nodeErrors.length === 0 || nodeErrors.some(error => error.type === 'NOT_FOUND' && error.path?.length === 2);
}
