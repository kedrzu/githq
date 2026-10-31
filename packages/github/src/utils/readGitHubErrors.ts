import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import type { GitHubGraphQLErrorEntry } from '../GitHubApiError.js';

/**
 * Reads the `errors` array of a parsed GitHub answer, keeping what is well-formed; empty when there is none.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function readGitHubErrors(payload: unknown): GitHubGraphQLErrorEntry[] {
    if (!isPlainObject(payload) || !Array.isArray(payload.errors)) {
        return [];
    }

    const errors: GitHubGraphQLErrorEntry[] = [];
    for (const entry of payload.errors) {
        if (!isPlainObject(entry)) {
            continue;
        }

        errors.push({
            type: typeof entry.type === 'string' ? entry.type : undefined,
            message: typeof entry.message === 'string' ? entry.message : 'Unknown error',
            path: Array.isArray(entry.path) ? entry.path.filter(isPathSegment) : undefined,
        });
    }

    return errors;
}

function isPathSegment(segment: unknown) {
    return typeof segment === 'string' || typeof segment === 'number';
}
