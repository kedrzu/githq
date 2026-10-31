import type { LucideIcon } from 'lucide-vue-next';

/**
 * How a list is laid out (D9): rows under group headers, or a board with a column per group. Every list —
 * my work, a repository, a project — offers both, with the same toolbar.
 */
export type ListLayout = 'board' | 'list';

/** The layouts in the order the toolbar's toggle shows them. */
export const LIST_LAYOUTS: readonly ListLayout[] = ['list', 'board'];

/**
 * One entry of a list: what a row or a card shows (`value` — an item, or in a project a project item, draft
 * issues included) under the id it is opened and selected by. `key` tells the entry apart from the same item
 * listed in another group (an issue with two labels, grouped by label), so selection and focus follow one place.
 */
export interface ListEntry<T> {
    /** Unique in the list. */
    readonly key: string;
    /** The item's id: what is opened, edited and selected together. */
    readonly id: string;
    readonly value: T;
}

/** A top-level entry and the entries nested under it — in my work, the pull requests closing an assigned issue. */
export interface ListRow<T> extends ListEntry<T> {
    readonly nested: readonly ListEntry<T>[];
}

/** What a group's header shows before its name. */
export type ListGroupMarker =
    /** A dot in a colour, hex without `#`: a label, a project option, an issue type. */
    | { readonly kind: 'color'; readonly color: string }
    /** A person: an assignee, an author. */
    | { readonly kind: 'avatar'; readonly name: string; readonly src: string }
    | { readonly kind: 'icon'; readonly icon: LucideIcon };

/** A group of a list: a section under its header, or a column of the board. */
export interface ListGroup<T> {
    /** Unique in the list; what moving an entry into the group names (`ListMove`). */
    readonly key: string;
    readonly label: string;
    readonly marker?: ListGroupMarker | null;
    /** Dim text after the count ("7 of 11 closed · due Nov 15"). */
    readonly detail?: string | null;
    /** `false` while its rows are still on their way (my work's first download, G7): it has none yet. */
    readonly arrived: boolean;
    readonly rows: readonly ListRow<T>[];
    /** Entries can be moved into it — dragged on the board, or `⇧←`/`⇧→` — when the entry allows it too. */
    readonly droppable: boolean;
}

/** An entry moved from one group into another: the list's owner turns it into an edit. */
export interface ListMove {
    readonly id: string;
    /** The group keys. */
    readonly from: string;
    readonly to: string;
}

/**
 * How a list is shown on this device: layout, grouping, order, the properties its rows show and its filter. The grouping,
 * order and property values are the list's own (a repository groups by milestone, a project by a field's id).
 */
export interface ListViewOptions<TGrouping extends string = string, TSort extends string = string> {
    readonly layout: ListLayout;
    readonly grouping: TGrouping;
    readonly sort: TSort;
    /** Shown in rows and cards, in no particular order. */
    readonly properties: readonly string[];
    /** The filter of a list that comes with one (a project's saved view, in GitHub's syntax); `''` keeps every item. */
    readonly filter?: string;
}

/** One choice of a list's toolbar or display options: a grouping, an order, a property. */
export interface ListChoice<T extends string = string> {
    readonly value: T;
    readonly label: string;
    readonly icon?: LucideIcon;
    /** Dim text after the label ("one column per label"). */
    readonly detail?: string;
    /** The heading it sits under in the grouping menu ("From GitHub"); choices of one heading follow each other. */
    readonly section?: string;
}
