import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';

/**
 * The errors of a partial `nodes(ids:)` answer by the index of the node they belong to; others are left out.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function groupNodeErrors(errors: readonly GitHubGraphQLErrorEntry[]) {
    const byNode = new Map<number, GitHubGraphQLErrorEntry[]>();
    for (const error of errors) {
        const [field, index] = error.path ?? [];
        if (field !== 'nodes' || typeof index !== 'number') {
            continue;
        }

        const nodeErrors = byNode.get(index) ?? [];
        nodeErrors.push(error);
        byNode.set(index, nodeErrors);
    }

    return byNode;
}
