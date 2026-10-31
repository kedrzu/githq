import type { GitHubMock, GitHubOperationData } from '../github/GitHubMock.js';
import { GitHubPartialAnswer } from '../github/GitHubMock.js';

/** A repository the tracking screens offer, as a test sets it up. */
export interface TrackingRepositoryParams {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly isPrivate?: boolean;
    readonly isArchived?: boolean;
    /** How long ago it saw a push. */
    readonly minutesAgo?: number;
}

/** What the tracking screens offer (G2): the viewer's own repositories and their organisations. */
export interface TrackingCandidatesParams {
    readonly login: string;
    readonly repositories?: readonly TrackingRepositoryParams[];
    readonly organizations?: readonly {
        readonly login: string;
        readonly repositories: readonly TrackingRepositoryParams[];
    }[];
    /** Organisations hiding their private data from githq: GitHub answers their part with a FORBIDDEN error (G5). */
    readonly hidingOrganizations?: readonly string[];
}

type CandidateNode = NonNullable<
    NonNullable<GitHubOperationData<'TrackingCandidates'>['viewer']['repositories']['nodes']>[number]
>;

/**
 * Answers what the tracking screens read (`TrackingCandidates` and `TrackingProjects`), as GitHub does: an
 * organisation hiding its private data from githq left out of the answer, with the error naming it. No projects.
 */
export function answerTrackingCandidates(github: GitHubMock, params: TrackingCandidatesParams): void {
    const hiding = params.hidingOrganizations ?? [];
    const errors = hiding.map(login => ({
        type: 'FORBIDDEN',
        message: `Although you appear to have the correct authorization credentials, the \`${login}\` organization has enabled OAuth App access restrictions, meaning that data access to third-parties is limited.`,
        path: ['viewer', 'organizations', 'nodes', 0],
    }));

    github.graphql(
        'TrackingCandidates',
        new GitHubPartialAnswer<'TrackingCandidates'>(
            {
                viewer: {
                    login: params.login,
                    repositories: toPage(params.repositories ?? []),
                    organizations: {
                        nodes: (params.organizations ?? []).map(organization => ({
                            login: organization.login,
                            avatarUrl: `https://avatars.githubusercontent.com/${organization.login}`,
                            repositories: toPage(organization.repositories),
                        })),
                    },
                },
            },
            errors,
        ),
    );
    github.graphql('TrackingProjects', {
        viewer: {
            projectsV2: { totalCount: 0, nodes: [] },
            organizations: {
                nodes: (params.organizations ?? []).map(organization => ({
                    login: organization.login,
                    projectsV2: { totalCount: 0, nodes: [] },
                })),
            },
        },
    });
}

/**
 * Answers the first download of the tracked repositories `names` with none of their items — every page empty —
 * and their change polls with no change. `hold` keeps the download's answers back until it resolves, to see it
 * under way.
 */
export function answerEmptyRepositories(
    github: GitHubMock,
    names: readonly string[],
    hold: Promise<void> = Promise.resolve(),
): void {
    for (const name of names) {
        github.rest('GET', `/repos/${name}/issues`, () => ({ status: 200, json: [], etag: `"${name}"` }));
    }

    const page = { totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] };
    github.graphql('RepositoryIssues', async () => {
        await hold;
        return { repository: { issues: page } };
    });
    github.graphql('RepositoryPullRequests', async () => {
        await hold;
        return { repository: { pullRequests: page } };
    });
}

/** Answers looking a repository up by name to track it (J3, G10), as GitHub has it. */
export function answerRepositoryLookup(github: GitHubMock, repository: TrackingRepositoryParams): void {
    github.graphql('RepositoryForTracking', { repository: toNode(repository) });
}

function toPage(repositories: readonly TrackingRepositoryParams[]) {
    return {
        totalCount: repositories.length,
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: repositories.map(toNode),
    };
}

function toNode(repository: TrackingRepositoryParams): CandidateNode {
    const [owner = ''] = repository.nameWithOwner.split('/');
    return {
        id: `R_${repository.nameWithOwner}`,
        nameWithOwner: repository.nameWithOwner,
        isPrivate: repository.isPrivate ?? false,
        isArchived: repository.isArchived ?? false,
        pushedAt: new Date(Date.now() - (repository.minutesAgo ?? 60) * 60_000).toISOString(),
        viewerPermission: 'ADMIN',
        owner: { login: owner },
        issues: { totalCount: 3 },
        pullRequests: { totalCount: 1 },
    };
}
