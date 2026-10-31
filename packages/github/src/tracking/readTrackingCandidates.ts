import { filterNotNull } from '@nzyme/utils/array/filterNotNull.js';

import type { GitHubSdk } from '../createGitHubRequester.js';
import type {
    TrackingCandidatesQuery,
    TrackingProjectFieldsFragment,
    TrackingProjectsQuery,
    TrackingRepositoryPageFieldsFragment,
} from '../generated.gen.js';
import type { GitHubGraphQLErrorEntry } from '../GitHubApiError.js';
import { readOAuthRestrictedOrganization } from '../utils/readOAuthRestrictedOrganization.js';

/** What the tracking screens offer to track (D4, G2): the viewer's own repositories and projects, and each organization's. */
export interface TrackingCandidates {
    /** The viewer's login. */
    login: string;
    /** The first page of the viewer's own repositories; the rest through `ViewerRepositories`. */
    repositories: TrackingRepositoryPageFieldsFragment;
    /** The viewer's own projects. */
    projects: TrackingProjectFieldsFragment[];
    organizations: TrackingOrganization[];
}

/** An organization the viewer belongs to, as the tracking screens list it. */
export interface TrackingOrganization {
    login: string;
    avatarUrl: string;
    /**
     * The organization's first 20 repositories, newest push first, the rest through `OrganizationRepositories`;
     * `null` when GitHub refused to list them.
     */
    repositories: TrackingRepositoryPageFieldsFragment | null;
    /** Its 50 most recently updated projects. */
    projects: TrackingProjectFieldsFragment[];
    /** All its projects the viewer can see, beyond the 50 read. */
    projectCount: number;
    /**
     * The organization has OAuth App access restrictions and has not approved githq: its private repositories
     * and projects are missing, and an owner has to approve githq (G5).
     */
    hiddenPrivate: boolean;
}

/** How {@link readTrackingCandidates} reports what it could not read. */
export interface ReadTrackingCandidatesOptions {
    /** The partial errors other than an organization's OAuth App restriction — for the log. */
    onPartialErrors?: (errors: readonly GitHubGraphQLErrorEntry[]) => void;
}

/**
 * Reads what the tracking screens offer (D4, G2) — `TrackingCandidates` and `TrackingProjects` side by side,
 * each one point. Both take partial answers, so an organization that hides its private resources from githq
 * (OAuth App access restrictions) leaves its part out and is marked {@link TrackingOrganization.hiddenPrivate}
 * instead of failing the whole read. GitHub then nulls the organization's whole entry, so it is rebuilt from
 * the login the error names.
 */
export async function readTrackingCandidates(
    sdk: GitHubSdk,
    options: ReadTrackingCandidatesOptions = {},
): Promise<TrackingCandidates> {
    const errors: GitHubGraphQLErrorEntry[] = [];
    const call = { onPartialErrors: (found: readonly GitHubGraphQLErrorEntry[]) => errors.push(...found) };
    const [candidates, projects] = await Promise.all([
        sdk.TrackingCandidates({}, call),
        sdk.TrackingProjects({}, call),
    ]);

    const restricted = new Set<string>();
    const otherErrors: GitHubGraphQLErrorEntry[] = [];
    for (const error of errors) {
        const login = readOAuthRestrictedOrganization(error);
        if (login === undefined) {
            otherErrors.push(error);
        } else {
            restricted.add(login);
        }
    }

    if (otherErrors.length > 0) {
        options.onPartialErrors?.(otherErrors);
    }

    const { viewer } = candidates;
    return {
        login: viewer.login,
        repositories: viewer.repositories,
        projects: filterNotNull(projects.viewer.projectsV2.nodes ?? []),
        organizations: readOrganizations(candidates, projects, restricted),
    };
}

function readOrganizations(
    candidates: TrackingCandidatesQuery,
    projects: TrackingProjectsQuery,
    restricted: ReadonlySet<string>,
) {
    const organizations = new Map<string, TrackingOrganization>();
    for (const node of filterNotNull(candidates.viewer.organizations.nodes ?? [])) {
        organizations.set(node.login, {
            login: node.login,
            avatarUrl: node.avatarUrl,
            repositories: node.repositories,
            projects: [],
            projectCount: 0,
            hiddenPrivate: restricted.has(node.login),
        });
    }

    for (const login of restricted) {
        if (!organizations.has(login)) {
            organizations.set(login, {
                login,
                // GitHub serves every account's avatar at this address.
                avatarUrl: `https://github.com/${encodeURIComponent(login)}.png`,
                repositories: null,
                projects: [],
                projectCount: 0,
                hiddenPrivate: true,
            });
        }
    }

    for (const node of filterNotNull(projects.viewer.organizations.nodes ?? [])) {
        const organization = organizations.get(node.login);
        if (organization) {
            organization.projects = filterNotNull(node.projectsV2.nodes ?? []);
            organization.projectCount = node.projectsV2.totalCount;
        }
    }

    return [...organizations.values()];
}
