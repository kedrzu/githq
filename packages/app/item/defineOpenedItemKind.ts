import type { HistoryState, LocationQuery, RouteLocation, RouteLocationRaw, RouteParamsGeneric } from 'vue-router';

/**
 * The kinds of item that open in the panel beside a list or on a page of their own (D9): an issue or a pull request
 * (`issue`, as GitHub's project pane names both), a workflow (actions D15), a commit and a workflow's run.
 */
export type OpenedItemKind = 'commit' | 'issue' | 'run' | 'workflow';

/** Every {@link OpenedItemKind}: each is also the query parameter naming its item in the pane. */
const OPENED_ITEM_KINDS = ['issue', 'workflow', 'commit', 'run'] as const satisfies readonly OpenedItemKind[];

/** The query parameter of GitHub's project pane: the kind of item it shows (`issue`, `workflow`, `commit`, `run`). */
const PANE_PARAM = 'pane';
/**
 * GitHub's own parameter naming the pane's item by its project item id, which githq does not have: a link that
 * carries only it opens the list, and opening an item drops it.
 */
const ITEM_ID_PARAM = 'itemId';
/**
 * The mark an item's page carries in the history when it was expanded from the panel: `{ kind, key }`, which item of
 * which kind. Kept through a replace of the address and a reload.
 */
const EXPANDED_FROM_STATE = 'expandedFrom';

/** What a kind of opened item is addressed by; the kind's own parts of {@link OpenedItemKindRoutes}. */
export interface OpenedItemKindOptions<TReference> {
    readonly kind: OpenedItemKind;
    /** The reference as the pane's parameter writes it (`owner|name|12`). */
    formatPaneValue(reference: TReference): string;
    /** The reference the pane's parameter names, or `null` when it is malformed. */
    parsePaneValue(value: string): TReference | null;
    /** The reference the params of the kind's page name, or `null` when they name none. */
    parsePageParams(params: RouteParamsGeneric): TReference | null;
    /** The address of the item's own page, GitHub's address of it. */
    getPagePath(reference: TReference): string;
    /** The reference as one string, the same for the same item: what the expanded-from mark carries. */
    formatKey(reference: TReference): string;
}

/** What a route reads to tell the item it opens. */
export type OpenedItemRouteSource = Pick<RouteLocation, 'meta' | 'params' | 'query'>;

/** An item of one kind a route opens. */
export interface OpenedKindRoute<TReference> {
    readonly reference: TReference;
    /** The item's own page; else it is opened over a screen, in the panel beside it. */
    readonly onPage: boolean;
}

/** The parameters of {@link OpenedItemKindRoutes.getExpandedLocation}. */
export interface GetExpandedLocationParams<TReference> {
    readonly reference: TReference;
    /** The page to expand to, when it is not the kind's own address of it (a pull request's `/pull/15`). */
    readonly path?: string;
}

/**
 * How a kind of opened item moves between the panel and its page: its addresses on both levels and the history mark
 * of a page expanded from the panel. Shared by every kind, so moving between the levels behaves the same for each.
 */
export interface OpenedItemKindRoutes<TReference> extends OpenedItemKindOptions<TReference> {
    /**
     * The item of this kind a route opens, or `null`: its own page (`meta.itemPage` of the kind), or a list with one
     * opened over it in GitHub's project-pane format (`?pane=<kind>&<kind>=…`).
     */
    getOpened(route: OpenedItemRouteSource): OpenedKindRoute<TReference> | null;
    /**
     * The query of a list with `reference` opened over it — or with nothing opened, for `null` — keeping the rest of
     * `query`; an item of another kind opened there is dropped.
     */
    getQuery(query: LocationQuery, reference: TReference | null): LocationQuery;
    /** An item's page expanded from the panel: pushed, with the mark that Back to the panel reads. */
    getExpandedLocation(params: GetExpandedLocationParams<TReference>): RouteLocationRaw;
    /**
     * The key ({@link OpenedItemKindOptions.formatKey}) of the item of this kind a page in the history was expanded
     * from the panel for; `null` for a page opened any other way, or expanded for another kind.
     */
    getExpandedFrom(state: HistoryState): string | null;
}

/**
 * The routes of a kind of opened item, from what addresses it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function defineOpenedItemKind<TReference>(
    options: OpenedItemKindOptions<TReference>,
): OpenedItemKindRoutes<TReference> {
    return { ...options, getOpened, getQuery, getExpandedLocation, getExpandedFrom };

    function getOpened(route: OpenedItemRouteSource): OpenedKindRoute<TReference> | null {
        if (route.meta.itemPage) {
            const reference = route.meta.itemPage === options.kind ? options.parsePageParams(route.params) : null;
            return reference ? { reference, onPage: true } : null;
        }

        const value = route.query[options.kind];
        const reference =
            route.query[PANE_PARAM] === options.kind && typeof value === 'string'
                ? options.parsePaneValue(value)
                : null;
        return reference ? { reference, onPage: false } : null;
    }

    function getQuery(query: LocationQuery, reference: TReference | null): LocationQuery {
        const rest: LocationQuery = { ...query };
        delete rest[PANE_PARAM];
        delete rest[ITEM_ID_PARAM];
        for (const kind of OPENED_ITEM_KINDS) {
            delete rest[kind];
        }

        if (reference === null) {
            return rest;
        }

        return { ...rest, [PANE_PARAM]: options.kind, [options.kind]: options.formatPaneValue(reference) };
    }

    function getExpandedLocation(params: GetExpandedLocationParams<TReference>): RouteLocationRaw {
        return {
            path: params.path ?? options.getPagePath(params.reference),
            state: { [EXPANDED_FROM_STATE]: { kind: options.kind, key: options.formatKey(params.reference) } },
        };
    }

    function getExpandedFrom(state: HistoryState): string | null {
        const mark = state[EXPANDED_FROM_STATE];
        if (mark === null || typeof mark !== 'object' || Array.isArray(mark)) {
            return null;
        }

        return mark.kind === options.kind && typeof mark.key === 'string' ? mark.key : null;
    }
}
