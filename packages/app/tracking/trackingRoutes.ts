import type { ProjectOwnerKind } from '@/projects/ProjectTypes.js';

/** The first download (G6), after choosing what to track. */
export const FIRST_DOWNLOAD_PATH = '/welcome/download';

/** The route path of a repository's view, at GitHub's address of it. */
export const REPOSITORY_PATH = '/:owner/:name';

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
 * The address of a repository's view, as on GitHub (`/owner/name`).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getRepositoryPath(nameWithOwner: string) {
    return `/${nameWithOwner}`;
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
