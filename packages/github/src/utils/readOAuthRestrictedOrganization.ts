import type { GitHubGraphQLErrorEntry } from '../GitHubApiError.js';

const RESTRICTION_PATTERN = /the `([^`]+)` organization has enabled OAuth App access restrictions/;

/**
 * Names the organization a GraphQL error says hides its private resources from githq: an organization with
 * OAuth App access restrictions that has not approved githq answers a read of them with a `FORBIDDEN` error,
 * "Although you appear to have the correct authorization credentials, the `<login>` organization has enabled
 * OAuth App access restrictions, meaning that data access to third-parties is limited. …" (G5). `undefined`
 * for any other error.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function readOAuthRestrictedOrganization(error: GitHubGraphQLErrorEntry): string | undefined {
    if (error.type !== 'FORBIDDEN') {
        return undefined;
    }

    return RESTRICTION_PATTERN.exec(error.message)?.[1];
}
