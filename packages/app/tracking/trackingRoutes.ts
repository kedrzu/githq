import type { ProjectOwnerKind } from '@/projects/ProjectTypes.js';
import type { RepositoryKind } from '@/repository/buildRepositoryList.js';

/** The first download (G6), after choosing what to track, under GitHub's reserved `/settings`. */
export const FIRST_DOWNLOAD_PATH = '/settings/tracking/download';

/**
 * The route path of a repository's view, at GitHub's addresses of it: the repository (`/owner/name`) and its
 * lists of issues and of pull requests (`/owner/name/issues`, `/owner/name/pulls`), all in one route.
 */
export const REPOSITORY_PATH = '/:owner/:name/:kind(issues|pulls)?';

/** The last segment of a repository's address listing one kind of its items, as on GitHub (`/owner/name/pulls`). */
export const REPOSITORY_KIND_SEGMENTS = {
    issues: 'issues',
    pullRequests: 'pulls',
} as const satisfies Record<Exclude<RepositoryKind, 'all'>, string>;

/** The origin every address githq does not show is handed off to; fixed here, never taken from an address. */
export const GITHUB_ORIGIN = 'https://github.com';

/**
 * First segments of GitHub's own pages, which no owner can be named: under them githq places its own pages
 * (`/login`, `/settings/…`, the "my work" lists at `/issues/…` and `/pulls/…`, projects under `/orgs` and
 * `/users`, the OAuth callback under `/auth`), and every other address under them is handed off to GitHub
 * rather than taken for a repository (`/orgs/acme`, `/settings/profile`).
 */
export const GITHUB_RESERVED_SEGMENTS = [
    'about',
    'account',
    'apps',
    'auth',
    'codespaces',
    'collections',
    'copilot',
    'dashboard',
    'discussions',
    'enterprise',
    'enterprises',
    'explore',
    'features',
    'issues',
    'join',
    'login',
    'logout',
    'marketplace',
    'new',
    'notifications',
    'organizations',
    'orgs',
    'pricing',
    'pulls',
    'repositories',
    'search',
    'security',
    'settings',
    'signup',
    'site',
    'sponsors',
    'stars',
    'topics',
    'trending',
    'users',
] as const;

/**
 * The route paths of a project's view, at GitHub's addresses of an organisation's and a user's project — and of one
 * of its saved views (`/orgs/acme/projects/3/views/2`), in the same route, so the project's link stays current.
 */
export const PROJECT_PATHS = [
    '/orgs/:owner/projects/:number(\\d+)/:views(views)?/:view(\\d+)?',
    '/users/:owner/projects/:number(\\d+)/:views(views)?/:view(\\d+)?',
] as const;

/** A project as its address names it. */
export interface ProjectAddress {
    readonly owner: string;
    readonly ownerKind: ProjectOwnerKind;
    readonly number: number;
}

/**
 * The address of a repository's view, as on GitHub (`/owner/name`), or of its list of one kind of its items
 * (`/owner/name/issues`, `/owner/name/pulls`).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getRepositoryPath(nameWithOwner: string, kind: RepositoryKind = 'all') {
    return kind === 'all' ? `/${nameWithOwner}` : `/${nameWithOwner}/${REPOSITORY_KIND_SEGMENTS[kind]}`;
}

/**
 * The kind of items a repository's address lists, from its last segment (the route's `kind`): both when it names
 * none.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getRepositoryKind(segment: unknown): RepositoryKind {
    switch (segment) {
        case REPOSITORY_KIND_SEGMENTS.issues:
            return 'issues';
        case REPOSITORY_KIND_SEGMENTS.pullRequests:
            return 'pullRequests';
        default:
            return 'all';
    }
}

/**
 * The github.com address of the same thing as `fullPath` (a route's path, query and fragment) — where an address
 * githq does not show is handed off to. The host is always GitHub's: `fullPath` is appended to it, never resolved
 * against it, so not even `//other.example` can name another.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getGitHubUrl(fullPath: string) {
    return `${GITHUB_ORIGIN}${fullPath.startsWith('/') ? '' : '/'}${fullPath}`;
}

/**
 * The address of a project's view, as on GitHub (`/orgs/acme/projects/3`), or of one of its saved views
 * (`/orgs/acme/projects/3/views/2`).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getProjectPath(project: ProjectAddress, view?: number) {
    const path = `/${project.ownerKind === 'org' ? 'orgs' : 'users'}/${project.owner}/projects/${project.number}`;
    return view === undefined ? path : `${path}/views/${view}`;
}
