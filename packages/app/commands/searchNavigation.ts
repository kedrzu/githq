import type { SettingsSection } from '@/settings/settingsRoutes.js';
import { isPendingItem } from '@/store/isPendingItem.js';
import type { Item } from '@/store/ItemTypes.js';
import { parseTrackingReference } from '@/tracking/utils/parseTrackingReference.js';

import { scoreText } from './scoreText.js';

/** Where the command menu lists a place: its heading (E1 "Go to", E3 "Projects", "Repositories"). */
export type NavigationGroup = 'goTo' | 'projects' | 'repositories' | 'items';

/** A screen of the app the menu jumps to: my work and its groups, a tracked project or saved view, a repository, Settings and its sections. */
export interface NavigationPlace {
    readonly id: string;
    readonly group: Exclude<NavigationGroup, 'items'>;
    readonly kind: 'myWork' | 'project' | 'view' | 'repository' | 'settings' | SettingsSection;
    readonly title: string;
    readonly detail?: string;
    /** Other words it is found by (a project's owner). */
    readonly keywords?: readonly string[];
    /** The key that also goes there, shown on its line (`,` for Settings). */
    readonly key?: string;
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
    | { readonly kind: 'place'; readonly score: number; readonly place: NavigationPlace }
    | { readonly kind: 'item'; readonly score: number; readonly item: Item }
    /** `owner/name` typed of a repository not tracked: its screen offers to track it (J3). */
    | { readonly kind: 'repository'; readonly score: number; readonly nameWithOwner: string };

/** How many items the menu lists at most. */
const ITEM_LIMIT = 8;

/** An item as typed: `#12`, `12`, `portal#12`, `sigma-clinic/portal#12`. */
const ITEM_NUMBER = /^(?:([\w.-]+(?:\/[\w.-]+)?))?#?(\d+)$/u;

/**
 * The places and items typed text finds in the local copy, best first. Places by their names; items by number
 * (`#123`, `repo#123`, `owner/repo#123`) above a title starting with the text above the title's words holding
 * it, newest first among equals; any `owner/name` or repository address that is not
 * tracked as a repository to open. Nothing typed:
 * every place, no item.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function searchNavigation(query: string, data: NavigationData): NavigationResult[] {
    const typed = query.trim();
    const results: NavigationResult[] = [];
    for (const place of data.places) {
        const score = scorePlace(typed, place);
        if (score !== null) {
            results.push({ kind: 'place', score, place });
        }
    }

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

function scorePlace(typed: string, place: NavigationPlace) {
    const scores = [place.title, ...(place.keywords ?? [])].map(text => scoreText(typed, text));
    const found = scores.filter(score => score !== null);
    return found.length === 0 ? null : Math.max(...found);
}

function findItems(typed: string, number: RegExpExecArray | null, items: readonly Item[]): NavigationResult[] {
    const found: { item: Item; score: number }[] = [];
    for (const item of items) {
        // An issue being created has no number to be found or opened by yet.
        if (isPendingItem(item)) {
            continue;
        }

        const score = number ? scoreNumber(item, number[1], Number(number[2])) : scoreTitle(typed, item.title);
        if (score !== null) {
            found.push({ item, score });
        }
    }

    return found
        .toSorted((a, b) => b.score - a.score || b.item.updatedAt.localeCompare(a.item.updatedAt))
        .slice(0, ITEM_LIMIT)
        .map(({ item, score }) => ({ kind: 'item', score, item }));
}

/** `#12` finds every item 12; `portal#12` the one in a repository named so, `owner/portal#12` in that one. */
function scoreNumber(item: Item, repository: string | undefined, number: number) {
    if (item.number !== number) {
        return null;
    }

    if (repository === undefined) {
        return 100;
    }

    const name = item.repository.nameWithOwner.toLowerCase();
    const wanted = repository.toLowerCase();
    return name === wanted || name.endsWith(`/${wanted}`) ? 100 : null;
}

/** A title found by its start or its words — not by scattered letters, which find too many. */
function scoreTitle(typed: string, title: string) {
    const score = scoreText(typed, title);
    return score !== null && score >= 40 ? score : null;
}
