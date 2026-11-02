import { GitHubApiError } from '@githq/github/GitHubApiError.js';

import type { EditFailureReason } from './EditTypes.js';

/**
 * How GitHub names the organisation in its refusal of an app the organisation restricts and has not approved (G5):
 * "Although you appear to have the correct authorization credentials, the `nzymejs` organization has enabled OAuth App
 * access restrictions, …". GitHub still lets such an app read the organisation's public repositories.
 */
const ORGANIZATION_RESTRICTED = /the `(?<organization>[^`]+)` organization has enabled OAuth App access restrictions/u;

/**
 * Why an edit that threw failed: an organisation that has not approved githq (G5), else GitHub's error — a GraphQL
 * error's message, else GitHub's own words of a REST refusal — or no answer at all.
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

    const message = error.errors[0]?.message ?? error.githubMessage ?? error.message;
    const organization = ORGANIZATION_RESTRICTED.exec(message)?.groups?.['organization'];
    if (organization) {
        return { kind: 'organizationRestricted', organization };
    }

    return { kind: 'refused', message };
}
