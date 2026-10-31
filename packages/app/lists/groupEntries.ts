import type { ItemUser } from '@/store/ItemTypes.js';

import type { ListGroup, ListGroupMarker, ListRow } from './ListTypes.js';

/**
 * The key of the group of entries without the grouped value ("No milestone", "No Status"): no milestone, label,
 * issue type, option, iteration or login is empty.
 */
export const NO_VALUE = '';

/** A value entries are grouped by: a milestone, a label, a person, a project field's option. */
export interface ListGroupValue {
    /** Unique among the grouping's values; what a move names. */
    readonly key: string;
    readonly label: string;
    readonly marker?: ListGroupMarker | null;
    readonly detail?: string | null;
}

/**
 * How a list groups its entries — by one of GitHub's properties, or (in a project) by a field. An entry with
 * several values (labels, assignees) is listed under each of them.
 */
export interface ListGrouping<T> {
    /**
     * Groups shown in this order even when empty — a project field's options, so every column of a board is
     * there to drop into. Values met that are not among them come after, by label.
     */
    readonly fixed?: readonly ListGroupValue[];
    /** The entry's values; none puts it in {@link none}. */
    readonly values: (value: T) => readonly ListGroupValue[];
    /** The group of entries without a value, last; shown only when it has some. */
    readonly none: ListGroupValue;
    /** Entries may be moved between its groups (an edit of the value), when the entry allows it. */
    readonly movable: boolean;
    /** The order of groups met outside {@link fixed}; by label when not given. */
    readonly compare?: (a: ListGroupValue, b: ListGroupValue) => number;
}

/** What {@link groupEntries} groups. */
export interface GroupEntriesParams<T> {
    /** In the order rows show them inside a group. */
    readonly entries: readonly T[];
    readonly getId: (value: T) => string;
    readonly grouping: ListGrouping<T>;
}

/**
 * The grouping of a list grouped by nothing: every entry in one group, called `label`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getUngroupedGrouping<T>(label: string): ListGrouping<T> {
    return { values: () => [], none: { key: 'all', label }, movable: false };
}

/**
 * The group of an entry's assignee: by login, with their avatar.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getAssigneeGroupValue(user: ItemUser): ListGroupValue {
    return { key: user.login, label: user.login, marker: { kind: 'avatar', name: user.login, src: user.avatarUrl } };
}

/**
 * The groups of a list: entries in their given order under each of their values, fixed groups first and in
 * their order, then the others met, then the entries without a value. Keys are `<group>:<id>`, unique even for
 * an entry listed in two groups.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function groupEntries<T>(params: GroupEntriesParams<T>): ListGroup<T>[] {
    const { entries, getId, grouping } = params;

    const fixed = grouping.fixed ?? [];
    const fixedKeys = new Set(fixed.map(value => value.key));
    const met = new Map<string, ListGroupValue>();
    const rows = new Map<string, ListRow<T>[]>();
    for (const entry of entries) {
        const id = getId(entry);
        const values = grouping.values(entry);
        for (const value of values.length > 0 ? values : [grouping.none]) {
            if (!fixedKeys.has(value.key) && !met.has(value.key)) {
                met.set(value.key, value);
            }

            const groupRows = rows.get(value.key) ?? [];
            groupRows.push({ key: `${value.key}:${id}`, id, value: entry, nested: [] });
            rows.set(value.key, groupRows);
        }
    }

    const none = met.get(grouping.none.key);
    met.delete(grouping.none.key);
    const others = [...met.values()].toSorted(grouping.compare ?? byLabel);

    const groups: ListGroup<T>[] = [];
    for (const value of [...fixed, ...others, ...(none ? [none] : [])]) {
        groups.push({
            key: value.key,
            label: value.label,
            marker: value.marker ?? null,
            detail: value.detail ?? null,
            arrived: true,
            rows: rows.get(value.key) ?? [],
            droppable: grouping.movable,
        });
    }

    return groups;
}

function byLabel(a: ListGroupValue, b: ListGroupValue) {
    return a.label.localeCompare(b.label);
}
