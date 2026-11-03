import type { ProjectOwnerKind } from '@/projects/ProjectTypes.js';
import type { RepositorySection } from '@/repository/RepositorySection.js';

/** The first download (G6), after choosing what to track, under GitHub's reserved `/settings`. */
export const FIRST_DOWNLOAD_PATH = '/settings/tracking/download';

/**
 * The route path of a repository's view, at GitHub's addresses of it: the repository (`/owner/name`, which opens
 * the section it was left on), its lists of issues and of pull requests (`/owner/name/issues`, `/owner/name/pulls`)
 * and its commits (`/owner/name/commits`), all in one route.
 */
export const REPOSITORY_PATH = '/:owner/:name/:section(issues|pulls|commits)?';

/**
 * The route path of a tracked repository's settings (T16), at GitHub's own address of a repository's settings. Its
 * static last segment outranks the hand-off of every other address (`/owner/name/tree/main`).
 */
export const REPOSITORY_SETTINGS_PATH = '/:owner/:name/settings';

/** The last segment of a repository's address naming one of its sections, as on GitHub (`/owner/name/pulls`). */
export const REPOSITORY_SECTION_SEGMENTS = {
    issues: 'issues',
    pullRequests: 'pulls',
    commits: 'commits',
} as const satisfies Record<RepositorySection, string>;

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

/** The route paths of a tracked project's settings (T17), at GitHub's own addresses of a project's settings. */
export const PROJECT_SETTINGS_PATHS = [
    '/orgs/:owner/projects/:number(\\d+)/settings',
    '/users/:owner/projects/:number(\\d+)/settings',
] as const;

/** A project as its address names it. */
export interface ProjectAddress {
    readonly owner: string;
    readonly ownerKind: ProjectOwnerKind;
    readonly number: number;
}

/**
 * The address of a repository's view, as on GitHub (`/owner/name`, opening the section it was left on), or of one of
 * its sections (`/owner/name/issues`, `/owner/name/pulls`, `/owner/name/commits`).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getRepositoryPath(nameWithOwner: string, section?: RepositorySection) {
    return section === undefined ? `/${nameWithOwner}` : `/${nameWithOwner}/${REPOSITORY_SECTION_SEGMENTS[section]}`;
}

/**
 * The address of a tracked repository's settings (T16), as on GitHub (`/owner/name/settings`).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getRepositorySettingsPath(nameWithOwner: string) {
    return `/${nameWithOwner}/settings`;
}

/**
 * The section a repository's address names, from its last segment (the route's `section`): `null` when it names
 * none (`/owner/name`).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getRepositorySection(segment: unknown): RepositorySection | null {
    switch (segment) {
        case REPOSITORY_SECTION_SEGMENTS.issues:
            return 'issues';
        case REPOSITORY_SECTION_SEGMENTS.pullRequests:
            return 'pullRequests';
        case REPOSITORY_SECTION_SEGMENTS.commits:
            return 'commits';
        default:
            return null;
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

/**
 * The address of a tracked project's settings (T17), as on GitHub (`/orgs/acme/projects/3/settings`).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getProjectSettingsPath(project: ProjectAddress) {
    return `${getProjectPath(project)}/settings`;
}
