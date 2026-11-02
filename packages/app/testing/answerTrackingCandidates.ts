import type { BrowserShape } from '@/services/Browser.js';

/** An owner's page of repositories GitHub answers, by `owner/name`; `total` when more than these exist. */
export interface AnsweredRepositories {
    readonly names: readonly string[];
    readonly total?: number;
}

/** A project GitHub answers, its owner the login it is listed under. */
export interface AnsweredProject {
    readonly title: string;
    readonly number: number;
    readonly closed?: boolean;
    /** How many days ago it was updated. */
    readonly daysAgo?: number;
    readonly items?: number;
}

/** What GitHub answers a spec about the tracking screens. */
export interface AnswerTrackingCandidatesOptions {
    readonly login: string;
    readonly repositories: AnsweredRepositories;
    readonly organizations?: Readonly<Record<string, AnsweredRepositories>>;
    /** Resolves when GitHub may answer what it offers; at once when not given. */
    readonly answered?: Promise<void>;
    /** GitHub fails to answer what it offers. */
    readonly failing?: boolean;
    /** Anyone's repositories the store can look up by name. */
    readonly lookups?: readonly string[];
    /** The projects of the user and of their organisations, by owner. */
    readonly projects?: Readonly<Record<string, readonly AnsweredProject[]>>;
    /**
     * Organisations hiding their private data from githq (G5): GitHub answers their part of the projects with a
     * FORBIDDEN error naming them.
     */
    readonly hidingOrganizations?: readonly string[];
    /** Anyone's projects the store can look up by address, by owner. */
    readonly projectLookups?: Readonly<Record<string, readonly AnsweredProject[]>>;
}

/**
 * For a spec or story over a real `TrackingStore`: a `fetch` answering what the tracking screens read, as GitHub does.
 * Anything else is a 502.
 * @util
 */
export function answerTrackingCandidates(options: AnswerTrackingCandidatesOptions): BrowserShape['fetch'] {
    return async (_input, init) => {
        const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
        const query = typeof body === 'object' && body !== null && 'query' in body ? String(body.query) : '';
        const variables =
            typeof body === 'object' && body !== null && 'variables' in body && typeof body.variables === 'object'
                ? body.variables
                : null;
        switch (/query\s+(\w+)/u.exec(query)?.[1]) {
            case 'TrackingCandidates':
                await options.answered;
                if (options.failing) {
                    return Response.json({ message: 'Server Error' }, { status: 502 });
                }

                return Response.json({
                    data: {
                        viewer: {
                            login: options.login,
                            repositories: toPage(options.repositories),
                            organizations: {
                                nodes: Object.entries(options.organizations ?? {}).map(([login, repositories]) => ({
                                    login,
                                    avatarUrl: '',
                                    repositories: toPage(repositories),
                                })),
                            },
                        },
                    },
                });
            case 'TrackingProjects': {
                const projects = options.projects ?? {};
                return Response.json({
                    data: {
                        viewer: {
                            projectsV2: toProjectPage(options.login, projects[options.login] ?? [], options.login),
                            organizations: {
                                nodes: Object.keys(options.organizations ?? {}).map(login => ({
                                    login,
                                    projectsV2: toProjectPage(login, projects[login] ?? [], options.login),
                                })),
                            },
                        },
                    },
                    errors: (options.hidingOrganizations ?? []).map((login, index) => ({
                        type: 'FORBIDDEN',
                        message: `Although you appear to have the correct authorization credentials, the \`${login}\` organization has enabled OAuth App access restrictions, meaning that data access to third-parties is limited.`,
                        path: ['viewer', 'organizations', 'nodes', index],
                    })),
                });
            }
            case 'ProjectForTracking': {
                const login = variables && 'login' in variables ? String(variables.login) : '';
                const number = variables && 'number' in variables ? Number(variables.number) : 0;
                const project = options.projectLookups?.[login]?.find(candidate => candidate.number === number);
                return Response.json({
                    data: {
                        repositoryOwner: { projectV2: project ? toProjectNode(login, project, options.login) : null },
                    },
                });
            }
            case 'RepositoryForTracking': {
                const owner = variables && 'owner' in variables ? String(variables.owner) : '';
                const name = variables && 'name' in variables ? String(variables.name) : '';
                const nameWithOwner = `${owner}/${name}`;
                return Response.json({
                    data: { repository: options.lookups?.includes(nameWithOwner) ? toNode(nameWithOwner) : null },
                });
            }

            default:
                return Response.json({ message: 'Server Error' }, { status: 502 });
        }
    };
}

function toPage({ names, total }: AnsweredRepositories) {
    return {
        totalCount: total ?? names.length,
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: names.map(toNode),
    };
}

function toNode(nameWithOwner: string) {
    return {
        id: `R_${nameWithOwner}`,
        nameWithOwner,
        isPrivate: false,
        isArchived: false,
        pushedAt: '2026-11-01T00:00:00Z',
        viewerPermission: 'ADMIN',
        owner: { login: nameWithOwner.split('/')[0] },
        issues: { totalCount: 0 },
        pullRequests: { totalCount: 0 },
    };
}

function toProjectPage(owner: string, projects: readonly AnsweredProject[], viewer: string) {
    return { totalCount: projects.length, nodes: projects.map(project => toProjectNode(owner, project, viewer)) };
}

function toProjectNode(owner: string, project: AnsweredProject, viewer: string) {
    const kind = owner === viewer ? 'users' : 'orgs';
    return {
        id: `PVT_${owner}_${project.number}`,
        title: project.title,
        number: project.number,
        url: `https://github.com/${kind}/${owner}/projects/${project.number}`,
        closed: project.closed ?? false,
        updatedAt: new Date(Date.now() - (project.daysAgo ?? 1) * 86_400_000).toISOString(),
        items: { totalCount: project.items ?? 0 },
        owner: { __typename: owner === viewer ? 'User' : 'Organization', login: owner },
    };
}
