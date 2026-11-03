import type { ProjectOwnerKind } from '@/projects/ProjectTypes.js';
import type { RepositoryTab } from '@/repository/buildRepositoryList.js';

/** The first download (G6), after choosing what to track, under GitHub's reserved `/settings`. */
export const FIRST_DOWNLOAD_PATH = '/settings/tracking/download';

/**
 * The broken workflows of every tracked repository (actions W2), under a first segment GitHub reserves
 * (`/dashboard`), so the address is never an owner's or a repository's.
 */
export const BROKEN_WORKFLOWS_PATH = '/dashboard/workflows';

/**
 * The route path of a repository's view, at GitHub's addresses of it: the repository (`/owner/name`), its lists of
 * issues and of pull requests (`/owner/name/issues`, `/owner/name/pulls`) and its workflows (`/owner/name/actions`,
 * actions D6), all in one route. The workflows' address of a repository not tracked is handed off to GitHub
 * (`middleware/auth.global.ts`, actions D4).
 */
export const REPOSITORY_PATH = '/:owner/:name/:kind(issues|pulls|actions)?';

/**
 * The route path of a workflow's run of a tracked repository (actions W4a), at GitHub's address of it. Everything else
 * under `actions/` (`attempts/…`, `workflows/…`, `runs/1/usage`) is GitHub's page, and so is this address of a
 * repository not tracked (`middleware/auth.global.ts`, actions D4).
 */
export const WORKFLOW_RUN_PATH = '/:owner/:name/actions/runs/:run(\\d+)';

/** The route path of a run with one of its jobs selected, at GitHub's address of the job. */
export const WORKFLOW_RUN_JOB_PATH = `${WORKFLOW_RUN_PATH}/job/:job(\\d+)`;

/**
 * The route path of a tracked repository's settings (T16), at GitHub's own address of a repository's settings. Its
 * static last segment outranks the hand-off of every other address (`/owner/name/tree/main`).
 */
export const REPOSITORY_SETTINGS_PATH = '/:owner/:name/settings';

/**
 * The last segment of a repository's address showing one of its tabs, as on GitHub: one kind of its items
 * (`/owner/name/pulls`), or its workflows (`/owner/name/actions`).
 */
export const REPOSITORY_TAB_SEGMENTS = {
    issues: 'issues',
    pullRequests: 'pulls',
    workflows: 'actions',
} as const satisfies Record<Exclude<RepositoryTab, 'all'>, string>;

/**
 * The places on a tracked repository's settings page an address can point to, by their element's id: the page
 * focuses the one named.
 */
export const REPOSITORY_SETTINGS_SECTIONS = {
    /** Which branches and tags raise workflow alerts (actions D5). */
    workflowAlerts: 'workflow-alerts',
    /** Workflow alerts' add field, for a failure without alerts: `v*` is two keys away (actions W13). */
    workflowAlertsAdd: 'workflow-alerts-add',
} as const;

/** A section of a tracked repository's settings page. */
export type RepositorySettingsSection = keyof typeof REPOSITORY_SETTINGS_SECTIONS;

/** What {@link getRouteNameWithOwner} reads of a route. */
export interface GetRouteNameWithOwnerParams {
    readonly params: Readonly<Record<string, unknown>>;
}

/**
 * The `owner/name` a repository's route names.
 * @util
 */
export function getRouteNameWithOwner(route: GetRouteNameWithOwnerParams) {
    return `${String(route.params.owner)}/${String(route.params.name)}`;
}

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
 * The address of a repository's view, as on GitHub (`/owner/name`), or of one of its tabs: its list of one kind of
 * its items (`/owner/name/issues`, `/owner/name/pulls`) or its workflows (`/owner/name/actions`).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getRepositoryPath(nameWithOwner: string, tab: RepositoryTab = 'all') {
    return tab === 'all' ? `/${nameWithOwner}` : `/${nameWithOwner}/${REPOSITORY_TAB_SEGMENTS[tab]}`;
}

/** Which run's address, and of which of its jobs. */
export interface GetWorkflowRunPathParams {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly runId: number;
    readonly jobId?: number;
}

/**
 * The address of a workflow's run, as on GitHub (`/owner/name/actions/runs/123`), or of one of its jobs
 * (`/owner/name/actions/runs/123/job/456`).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getWorkflowRunPath(params: GetWorkflowRunPathParams) {
    const { nameWithOwner, runId, jobId } = params;
    const path = `/${nameWithOwner}/actions/runs/${runId}`;
    return jobId === undefined ? path : `${path}/job/${jobId}`;
}

/**
 * The address of a tracked repository's settings (T16), as on GitHub (`/owner/name/settings`), or of one of its
 * sections (`/owner/name/settings#workflow-alerts`), which the page brings into view.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getRepositorySettingsPath(nameWithOwner: string, section?: RepositorySettingsSection) {
    const path = `/${nameWithOwner}/settings`;
    return section ? `${path}#${REPOSITORY_SETTINGS_SECTIONS[section]}` : path;
}

/** What {@link isWorkflowRunRoute} reads of a route. */
export interface IsWorkflowRunRouteParams {
    readonly name?: unknown;
}

/**
 * Whether a route shows a run of a repository's workflows.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isWorkflowRunRoute(route: IsWorkflowRunRouteParams) {
    return route.name === 'workflow-run' || route.name === 'workflow-run-job';
}

/**
 * The tab a repository's address shows, from its last segment (the route's `kind`): all its items when it names
 * none.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getRepositoryTab(segment: unknown): RepositoryTab {
    switch (segment) {
        case REPOSITORY_TAB_SEGMENTS.issues:
            return 'issues';
        case REPOSITORY_TAB_SEGMENTS.pullRequests:
            return 'pullRequests';
        case REPOSITORY_TAB_SEGMENTS.workflows:
            return 'workflows';
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

/**
 * The address of a tracked project's settings (T17), as on GitHub (`/orgs/acme/projects/3/settings`).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getProjectSettingsPath(project: ProjectAddress) {
    return `${getProjectPath(project)}/settings`;
}
