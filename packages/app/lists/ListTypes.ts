import type { LucideIcon } from 'lucide-vue-next';

import type { PullRequestItem } from '@/store/ItemTypes.js';
import type { StackDescription } from '@/store/stacks/describeStack.js';
import type { StackShare } from '@/store/stacks/describeStackShare.js';

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

/** What a list's context menu is drawn for (`ListView`'s `contextMenu`). */
export interface ListContextMenuProps {
    /** The items it acts on: those edited together, or the one right-clicked. */
    readonly ids: readonly string[];
    /** Opens the one item it acts on, as Enter would. */
    readonly open: () => void;
}

/**
 * A top-level entry and the entries nested under it — in my work, the pull requests closing an assigned issue. A
 * stack's entry (D2, D3) has a synthetic `id` (`stack:<stack id>`, never an item's), its `stack`, the member `Enter`
 * opens as its `value`, and the stack's pull requests in its group as `nested`, shown only while it is expanded.
 */
export interface ListRow<T> extends ListEntry<T> {
    readonly nested: readonly ListEntry<T>[];
    /** Set on a stack's entry. */
    readonly stack?: ListStack | null;
    /**
     * Set on an open pull request of a stack listed as a plain row — alone in its group, or the last open one of its
     * stack (D3, D16, SP13): the stack, described, for the row's marker.
     */
    readonly stackMarker?: StackDescription | null;
}

/** What a stack's entry stands for: the stack, described, and its pull requests in the entry's group. */
export interface ListStack {
    /** The stack's node id: what is expanded, in every list at once (D10). */
    readonly id: string;
    readonly description: StackDescription;
    /** The id of the pull request `Enter` opens (D9): the first open one not yet approved, else the first open one. */
    readonly open: string;
    /** The entry's pull requests, in the stack's order: the entry's `nested`, as items. */
    readonly pullRequests: readonly PullRequestItem[];
    /** Set when they are a share of the stack's open pull requests, the others in other groups (D3, D16): "2 of 4". */
    readonly share?: StackShare | null;
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
    /** Drawn before `detail` (my work's "not tracked" repositories). */
    readonly detailIcon?: LucideIcon | null;
    /** The label is a name from code, set in the monospaced font (a repository's `owner/name`). */
    readonly monospace?: boolean;
    /** `false` while its rows are still on their way (my work's first download, G7): it has none yet. */
    readonly arrived: boolean;
    readonly rows: readonly ListRow<T>[];
    /** Entries can be moved into it — dragged on the board, or `⇧←`/`⇧→` — when the entry allows it too. */
    readonly droppable: boolean;
}

/** An entry moved from one group into another: the list's owner turns it into an edit of each of its items. */
export interface ListMove {
    /** The items moved: the entry's own, or a stack entry's pull requests (D3) — never the entry's own id. */
    readonly ids: readonly string[];
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
