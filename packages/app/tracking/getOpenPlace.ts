import { assertNever } from '@nzyme/utils/assertNever.js';

import { CommitRoutes } from '@/commits/commitRoutes.js';
import type { OpenedItemRouteSource } from '@/item/defineOpenedItemKind.js';
import type { ItemList } from '@/item/ItemNavigation.js';
import { getOpenedItemRoute, getReviewReference } from '@/item/itemRoutes.js';
import type { ItemReference, OpenedItemRoute } from '@/item/itemRoutes.js';
import type { ProjectView } from '@/projects/ProjectTypes.js';
import { ALL_ITEMS_LIST } from '@/projects/projectViewOptions.js';
import type { RepositorySection } from '@/repository/RepositorySection.js';
import type { Item } from '@/store/ItemTypes.js';
import { WorkflowRoutes } from '@/workflows/workflowRoutes.js';

import type { ProjectAddress } from './trackingRoutes.js';
import { getRepositorySection, getRouteNameWithOwner } from './trackingRoutes.js';

/**
 * The repository's section or the project's view a screen is in, which the sidebar expands under its row: a project's
 * view by its key — a saved view's id, or `ALL_ITEMS_LIST` for "All items" (K9); `null` for a project without saved
 * views, or whose copy is not loaded yet.
 */
export type OpenPlace =
    | { readonly kind: 'repository'; readonly nameWithOwner: string; readonly section: RepositorySection }
    | { readonly kind: 'project'; readonly id: string; readonly viewKey: string | null };

/** What {@link getOpenPlace} reads of a route. */
export interface OpenPlaceRoute extends OpenedItemRouteSource {
    readonly name?: unknown;
}

/** A project as {@link getOpenPlace} finds its views. */
export interface OpenPlaceProject {
    readonly id: string;
    /** Its saved views in its order. */
    readonly views: readonly Pick<ProjectView, 'id' | 'number'>[];
}

/** An issue or pull request as {@link getOpenPlace} tells its section and its step in a list. */
export interface OpenPlaceItem {
    readonly id: string;
    readonly kind: Item['kind'];
}

/** What {@link getOpenPlace} tells the place from. */
export interface GetOpenPlaceParams {
    /** The route shown. */
    readonly route: OpenPlaceRoute;
    /** The list items were opened from last (`ItemNavigation.list`); `null` before any. */
    readonly list: ItemList | null;
    /** The route an address of the app resolves to (`router.resolve`): the list's, from its path. */
    readonly resolve: (path: string) => OpenPlaceRoute;
    /** The section a repository's view shows at an address naming `addressSection` (`LastRepositoryTab.getShown`). */
    readonly getShownSection: (nameWithOwner: string, addressSection: RepositorySection | null) => RepositorySection;
    /** The tracked project an address names, `null` for one not tracked. */
    readonly findProject: (address: ProjectAddress) => OpenPlaceProject | null;
    /** The issue or pull request a reference names in the local copy, `null` while it is not there. */
    readonly findItem: (reference: ItemReference) => OpenPlaceItem | null;
}

/**
 * The place the screen shown is in, or `null` outside any (My work, Settings): a repository's section or a project's
 * view — with an item over it in the panel too, as the panel is a query on the list's address. An item full screen is
 * in the list it was opened from while that list steps through it (the list is kept after it is left), else in its own
 * repository's section of its kind; a pull request's review is a pull request full screen.
 * @__NO_SIDE_EFFECTS__
 */
export function getOpenPlace(params: GetOpenPlaceParams): OpenPlace | null {
    const { route } = params;
    const review = route.name === 'review' ? getReviewReference(route) : null;
    const opened = review ? { kind: 'issue' as const, reference: review, onPage: true } : getOpenedItemRoute(route);
    return opened?.onPage ? getItemPlace(opened, params) : getListPlace(route, params);
}

/** The place an item on its own page is in. */
function getItemPlace(opened: OpenedItemRoute, params: GetOpenPlaceParams): OpenPlace | null {
    const { list, route } = params;
    const item = opened.kind === 'issue' ? params.findItem(opened.reference) : null;
    const id = getStepId(opened, item);
    if (list?.kind === opened.kind && id !== null && (list.steps.includes(id) || list.stepOf.has(id))) {
        return getListPlace(params.resolve(list.path), params);
    }

    const { owner, name } = opened.reference;
    return { kind: 'repository', nameWithOwner: `${owner}/${name}`, section: getItemSection() };

    function getItemSection(): RepositorySection {
        switch (opened.kind) {
            case 'issue': {
                // Not in the local copy yet, the address's segment says.
                const kind = item?.kind ?? (route.name === 'item-issue' ? 'issue' : 'pullRequest');
                return kind === 'issue' ? 'issues' : 'pullRequests';
            }
            case 'workflow':
            case 'run':
                return 'workflows';
            case 'commit':
                return 'commits';
            default:
                return assertNever(opened);
        }
    }
}

/** What a list steps through the item by: an issue's or pull request's id, a workflow's or commit's key; a run none. */
function getStepId(opened: OpenedItemRoute, item: OpenPlaceItem | null) {
    switch (opened.kind) {
        case 'issue':
            return item?.id ?? null;
        case 'workflow':
            return WorkflowRoutes.formatKey(opened.reference);
        case 'commit':
            return CommitRoutes.formatKey(opened.reference);
        case 'run':
            return null;
        default:
            return assertNever(opened);
    }
}

/** The place a list's route is: a repository's section or a project's view. */
function getListPlace(route: OpenPlaceRoute, params: GetOpenPlaceParams): OpenPlace | null {
    switch (route.name) {
        case 'repository': {
            const nameWithOwner = getRouteNameWithOwner(route);
            const section = params.getShownSection(nameWithOwner, getRepositorySection(route.params.section));
            return { kind: 'repository', nameWithOwner, section };
        }
        case 'project-org':
        case 'project-user': {
            const project = params.findProject({
                owner: String(route.params.owner),
                ownerKind: route.name === 'project-org' ? 'org' : 'user',
                number: Number(route.params.number),
            });
            if (!project) {
                return null;
            }

            if (route.query.all !== undefined) {
                return { kind: 'project', id: project.id, viewKey: ALL_ITEMS_LIST };
            }

            // The view the address names, else the first, as the project's page shows.
            const number = typeof route.params.view === 'string' ? Number(route.params.view) : null;
            const view = project.views.find(candidate => candidate.number === number) ?? project.views[0];
            return { kind: 'project', id: project.id, viewKey: view?.id ?? null };
        }
        default:
            return null;
    }
}
