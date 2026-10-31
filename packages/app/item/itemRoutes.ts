import type { LocationQuery, RouteLocation } from 'vue-router';

import { isPendingItem } from '@/store/isPendingItem.js';
import type { Item } from '@/store/ItemTypes.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';
import type { RepositoryName } from '@/utils/parseRepositoryName.js';

/**
 * How an opened item is shown (D9): beside the list it was opened from, over it, or on a page of its own. The
 * same item view in all three.
 */
export type ItemArrangement = 'modal' | 'page' | 'panel';

/** The arrangements, in the order the item view's switch shows them. */
export const ITEM_ARRANGEMENTS: readonly ItemArrangement[] = ['panel', 'modal', 'page'];

/** An issue or pull request as an address names it: its repository and number. */
export interface ItemReference extends RepositoryName {
    readonly number: number;
}

/** What a route opens: an item, on its own page or over a list. */
export interface OpenedItemRoute {
    readonly reference: ItemReference;
    /**
     * The item's own page (`/owner/name/issues/12`); else it is opened over a list, in the panel or the modal the
     * browser remembers (`ItemNavigation.listArrangement`), which the address does not say.
     */
    readonly onPage: boolean;
}

/**
 * The route paths of an item's own page, shaped like GitHub's: a github.com path pasted after the app's host
 * opens the same item. Issue or pull request, the item is found by its number; the segment only mirrors GitHub,
 * and settles on the item's kind once it is known.
 */
export const ITEM_PAGE_PATHS = ['/:owner/:name/issues/:number(\\d+)', '/:owner/:name/pull/:number(\\d+)'] as const;

/** The query parameter of GitHub's project pane: `issue` when the pane shows an issue or a pull request. */
const PANE_PARAM = 'pane';
/** What {@link PANE_PARAM} says for an item. */
const PANE_ISSUE = 'issue';
/** The query parameter naming the item in GitHub's project pane: `owner|name|number`. */
const ISSUE_PARAM = 'issue';
/**
 * GitHub's own parameter naming the pane's item by its project item id, which githq does not have: a link that
 * carries only it opens the list, and opening an item drops it.
 */
const ITEM_ID_PARAM = 'itemId';
/** What separates the owner, the name and the number in {@link ISSUE_PARAM}. */
const ISSUE_SEPARATOR = '|';

/**
 * The item a route opens, or `null`: the item's own page (`/owner/name/issues/12`), or a list with one opened over
 * it in GitHub's project-pane format (`?pane=issue&issue=owner%7Cname%7C12`).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getOpenedItemRoute(route: Pick<RouteLocation, 'meta' | 'params' | 'query'>): OpenedItemRoute | null {
    if (route.meta.itemPage) {
        const { owner, name, number } = route.params;
        const reference =
            typeof owner === 'string' && typeof name === 'string' ? toReference(owner, name, number) : null;
        return reference ? { reference, onPage: true } : null;
    }

    const issue = route.query[ISSUE_PARAM];
    const reference =
        route.query[PANE_PARAM] === PANE_ISSUE && typeof issue === 'string' ? parsePaneReference(issue) : null;
    return reference ? { reference, onPage: false } : null;
}

/**
 * The query of a list with `item` opened over it — or with nothing opened, for `null` — keeping the rest of
 * `query`. Written as GitHub's project pane: `pane=issue&issue=owner|name|number`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getOpenedItemQuery(query: LocationQuery, item: ItemReference | null): LocationQuery {
    const rest: LocationQuery = { ...query };
    delete rest[PANE_PARAM];
    delete rest[ISSUE_PARAM];
    delete rest[ITEM_ID_PARAM];
    if (!item) {
        return rest;
    }

    return { ...rest, [PANE_PARAM]: PANE_ISSUE, [ISSUE_PARAM]: formatPaneReference(item) };
}

/**
 * The address of an item's own page, as GitHub's: `/owner/name/issues/12` or `/owner/name/pull/15`. Either
 * opens the item whatever its kind, as on GitHub; an item not known yet goes under `issues`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getItemPagePath(reference: ItemReference, kind: Item['kind'] = 'issue') {
    return `/${reference.owner}/${reference.name}/${kind === 'issue' ? 'issues' : 'pull'}/${reference.number}`;
}

/**
 * The reference of an item the app holds.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getItemReference(item: Item): ItemReference {
    return { ...parseRepositoryName(item.repository.nameWithOwner), number: item.number };
}

/**
 * `name#number`, how an item is named where its owner goes without saying (the command menu's chip and results, a
 * parent); `name#…` for an issue GitHub has not numbered yet.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formatShortReference(item: Item) {
    const { name } = parseRepositoryName(item.repository.nameWithOwner);
    return `${name}#${isPendingItem(item) ? '…' : item.number}`;
}

/**
 * `owner/name/number`: an item's reference as one string, the same for the same item (the resolver's key).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formatItemReference(reference: ItemReference) {
    return `${reference.owner}/${reference.name}/${reference.number}`;
}

function formatPaneReference(reference: ItemReference) {
    return [reference.owner, reference.name, reference.number].join(ISSUE_SEPARATOR);
}

/** The reference an `issue` parameter carries, or `null` when it is not `owner|name|number`. */
function parsePaneReference(value: string): ItemReference | null {
    const [owner, name, number, ...rest] = value.split(ISSUE_SEPARATOR);
    return owner && name && rest.length === 0 ? toReference(owner, name, number) : null;
}

function toReference(owner: string, name: string, number: unknown): ItemReference | null {
    if (typeof number !== 'string' || !/^[1-9]\d*$/u.test(number) || !owner || !name) {
        return null;
    }

    return { owner, name, number: Number(number) };
}

declare module 'vue-router' {
    interface RouteMeta {
        /** The route is an item's own page (`ITEM_PAGE_PATHS`). */
        itemPage?: boolean;
    }
}
