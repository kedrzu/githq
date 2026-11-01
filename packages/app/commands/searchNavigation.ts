import { formatShortReference } from '@/item/itemRoutes.js';
import { isPendingItem } from '@/store/isPendingItem.js';
import type { Item } from '@/store/ItemTypes.js';
import { parseTrackingReference } from '@/tracking/utils/parseTrackingReference.js';
import { findMatches, prepareMatchTexts } from '@/utils/findMatches.js';
import type { PreparedMatchTexts } from '@/utils/findMatches.js';

import { findMenuRows } from './findMenuRows.js';
import type { CommandMenuMatch } from './findMenuRows.js';

/** Where the command menu lists a place: its heading (E1 "Go to", E3 "Projects", "Repositories"). */
export type NavigationGroup = 'goTo' | 'projects' | 'repositories' | 'items';

/** A screen of the app the menu jumps to: my work and its groups, a tracked project or saved view, a repository. */
export interface NavigationPlace {
    readonly id: string;
    readonly group: Exclude<NavigationGroup, 'items'>;
    readonly kind: 'myWork' | 'project' | 'view' | 'repository' | 'tracking' | 'account';
    readonly title: string;
    readonly detail?: string;
    /** Other words it is found by (a project's owner). */
    readonly keywords?: readonly string[];
    /** The app's address of it. */
    readonly path: string;
}

/** What the menu finds places and items in: the local copy, nothing read from GitHub (instant). */
export interface NavigationData {
    readonly places: readonly NavigationPlace[];
    /** The tracked repositories (`owner/name`): one typed that is not opens its own screen to track it (J3). */
    readonly trackedRepositories: readonly string[];
    readonly items: readonly Item[];
}

/** A place or an item the typed text finds. */
export type NavigationResult =
    /** `match` is `null` when nothing is typed: every place is listed, none is marked. */
    | {
          readonly kind: 'place';
          readonly score: number;
          readonly place: NavigationPlace;
          readonly match: CommandMenuMatch | null;
      }
    | { readonly kind: 'item'; readonly score: number; readonly item: Item; readonly match: CommandMenuMatch }
    /** `owner/name` typed of a repository not tracked: its screen offers to track it (J3). */
    | { readonly kind: 'repository'; readonly score: number; readonly nameWithOwner: string };

/** How many items the menu lists at most. */
const ITEM_LIMIT = 8;

/** How many items a query ranks, the newest of those it finds: over 50,000 items, ranking them all takes frames. */
const ITEM_HIT_LIMIT = 1000;

/** The items as searched, per `items` array: readying them is the one step too slow to repeat per keystroke. */
const PREPARED_ITEMS = new WeakMap<readonly Item[], PreparedMatchTexts<Item>>();

/** An item as typed: `#12`, `12`, `portal#12`, `skyline-labs/portal#12`. */
const ITEM_NUMBER = /^(?:([\w.-]+(?:\/[\w.-]+)?)?#)?(\d+)$/u;

/** `#12`: nothing but an item's number is asked for. */
const ONLY_ITEM_NUMBER = /^#\d+$/u;

/**
 * The places and items typed text finds in the local copy, best first, each with what the menu marks. Places by
 * their names; items by number (`#123`, `repo#123`, `owner/repo#123`) above a title starting with the text above
 * the title's words holding it, newest first among equals; any `owner/name` or repository address that is not
 * tracked as a repository to open. `#123` is items only. Nothing typed: every place, no item.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function searchNavigation(query: string, data: NavigationData): NavigationResult[] {
    const typed = query.trim();
    const places = isOnlyItemNumber(typed) ? [] : data.places;
    const results: NavigationResult[] = findMenuRows(typed, places).map(({ row, score, match }) => ({
        kind: 'place',
        score,
        place: row,
        match,
    }));

    if (typed === '') {
        return results;
    }

    const number = ITEM_NUMBER.exec(typed);
    results.push(...findItems(typed, number, data.items));

    const repository = number ? null : parseTrackingReference(typed);
    if (repository?.kind === 'repository') {
        const nameWithOwner = `${repository.owner}/${repository.name}`;
        if (!data.trackedRepositories.some(name => name.toLowerCase() === nameWithOwner.toLowerCase())) {
            results.push({ kind: 'repository', score: 100, nameWithOwner });
        }
    }

    return results.toSorted((a, b) => b.score - a.score);
}

/**
 * Whether typed text asks for an item's number and nothing else (`#123`): no action, option or place is found by it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isOnlyItemNumber(typed: string) {
    return ONLY_ITEM_NUMBER.test(typed);
}

function findItems(typed: string, number: RegExpExecArray | null, items: readonly Item[]): NavigationResult[] {
    const prepared = prepareItems(items);
    const found = number ? findItemsByNumber(prepared.rows, number[1], Number(number[2])) : findItemsByTitle();
    return found.slice(0, ITEM_LIMIT);

    function findItemsByTitle(): NavigationResult[] {
        return findMatches(typed, prepared, { hitLimit: ITEM_HIT_LIMIT }).map(({ row, score, ranges }) => ({
            kind: 'item',
            score,
            item: row,
            match: { field: 'title', text: row.title, ranges },
        }));
    }
}

/** Newest first, so a stable ranking keeps the newest first among equals. An issue being created has no number yet. */
function prepareItems(items: readonly Item[]) {
    const kept = PREPARED_ITEMS.get(items);
    if (kept) {
        return kept;
    }

    const searched = items
        .filter(item => !isPendingItem(item))
        .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const prepared = prepareMatchTexts(searched, item => [item.title]);
    PREPARED_ITEMS.set(items, prepared);
    return prepared;
}

function findItemsByNumber(items: readonly Item[], repository: string | undefined, number: number) {
    const found: NavigationResult[] = [];
    for (const item of items) {
        if (hasNumber(item, repository, number)) {
            const reference = formatShortReference(item);
            found.push({
                kind: 'item',
                score: 100,
                item,
                match: {
                    field: 'reference',
                    text: reference,
                    ranges: [reference.length - String(number).length, reference.length],
                },
            });
        }
    }

    return found;
}

/** `#12` finds every item 12; `portal#12` the one in a repository named so, `owner/portal#12` in that one. */
function hasNumber(item: Item, repository: string | undefined, number: number) {
    if (item.number !== number) {
        return false;
    }

    if (repository === undefined) {
        return true;
    }

    const name = item.repository.nameWithOwner.toLowerCase();
    const wanted = repository.toLowerCase();
    return name === wanted || name.endsWith(`/${wanted}`);
}
