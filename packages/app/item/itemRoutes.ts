import type { LocationQuery, RouteLocationNormalizedLoaded } from 'vue-router';

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

/** What a route opens: an item, and how. */
export interface OpenedItemRoute {
    readonly reference: ItemReference;
    readonly arrangement: ItemArrangement;
}

/**
 * The route paths of an item's own page, shaped like GitHub's: a github.com path pasted after the app's host
 * opens the same item. Issue or pull request, the item is found by its number; the segment only mirrors GitHub.
 */
export const ITEM_PAGE_PATHS = ['/:owner/:name/issues/:number(\\d+)', '/:owner/:name/pull/:number(\\d+)'] as const;

/** The query parameter naming the item opened over a list: `owner/name/number`. */
const OPEN_PARAM = 'open';
/** The query parameter saying how it is opened over the list: `panel` (when missing) or `modal`. */
const ARRANGEMENT_PARAM = 'as';

/**
 * The item a route opens, or `null`: the item's own page (`/owner/name/issues/12`), or a list with one opened over
 * it (`?open=owner/name/12&as=modal`).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getOpenedItemRoute(route: RouteLocationNormalizedLoaded): OpenedItemRoute | null {
    if (route.meta.itemPage) {
        const { owner, name, number } = route.params;
        const reference =
            typeof owner === 'string' && typeof name === 'string' ? toReference(owner, name, number) : null;
        return reference ? { reference, arrangement: 'page' } : null;
    }

    const open = route.query[OPEN_PARAM];
    const reference = typeof open === 'string' ? parseItemReference(open) : null;
    if (!reference) {
        return null;
    }

    return { reference, arrangement: route.query[ARRANGEMENT_PARAM] === 'modal' ? 'modal' : 'panel' };
}

/**
 * The query of a list with `item` opened over it in `arrangement` — or with nothing opened, for `null` — keeping
 * the rest of `query`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getOpenedItemQuery(
    query: LocationQuery,
    item: ItemReference | null,
    arrangement: Exclude<ItemArrangement, 'page'> = 'panel',
): LocationQuery {
    const rest: LocationQuery = { ...query };
    delete rest[OPEN_PARAM];
    delete rest[ARRANGEMENT_PARAM];
    if (!item) {
        return rest;
    }

    return arrangement === 'panel'
        ? { ...rest, [OPEN_PARAM]: formatItemReference(item) }
        : { ...rest, [OPEN_PARAM]: formatItemReference(item), [ARRANGEMENT_PARAM]: arrangement };
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
 * `owner/name/number`, as the `open` parameter carries it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formatItemReference(reference: ItemReference) {
    return `${reference.owner}/${reference.name}/${reference.number}`;
}

/**
 * The reference an `open` parameter carries, or `null` when it is not `owner/name/number`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function parseItemReference(value: string): ItemReference | null {
    const [owner, name, number, ...rest] = value.split('/');
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
