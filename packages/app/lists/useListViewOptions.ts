import { useService } from '@nzyme/vue-ioc/useService.js';
import { makeRef } from '@nzyme/vue-utils/reactivity/makeRef.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { computed } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import { LIST_LAYOUTS } from './ListTypes.js';
import type { ListLayout, ListViewOptions } from './ListTypes.js';
import { ListViewOptionsStore } from './ListViewOptionsStore.js';

/** What a list's view options may be set to; a kept value no longer among them is dropped. */
export interface ListViewChoices<TGrouping extends string, TSort extends string> {
    readonly groupings: readonly TGrouping[];
    readonly sorts: readonly TSort[];
    readonly properties: readonly string[];
}

/** Which list's options, and what they are when nothing was changed on this device. */
export interface UseListViewOptionsOptions<TGrouping extends string, TSort extends string> {
    /** The list, unique on the device: `myWork`, `repository:acme/api`, a project view's id. */
    readonly list: MaybeRefOrGetter<string>;
    /** The options as the list comes — in a project, as its saved view on GitHub (D13). */
    readonly defaults: MaybeRefOrGetter<ListViewOptions<TGrouping, TSort>>;
    readonly choices: MaybeRefOrGetter<ListViewChoices<TGrouping, TSort>>;
}

/** A list's view options on this device. */
export interface ListViewOptionsViewModel<TGrouping extends string, TSort extends string> {
    readonly options: ListViewOptions<TGrouping, TSort>;
    /** Some option differs from the defaults: a project's view shows it is "modified locally" (D13). */
    readonly modified: boolean;
    /** Changes some options; one set back to its default is no longer kept as changed. */
    set(changes: Partial<ListViewOptions<TGrouping, TSort>>): void;
    /** Back to the defaults. */
    reset(): void;
}

/** What is kept of a list's options: only those changed from the defaults. */
interface KeptOptions {
    readonly layout?: ListLayout;
    readonly grouping?: string;
    readonly sort?: string;
    readonly properties?: readonly string[];
    readonly filter?: string;
}

/**
 * A list's layout, grouping, order, shown properties and filter (a project view's), kept in this browser per list and user
 * (`ListViewOptionsStore`, D9, D13): local only,
 * never written to GitHub. Only what differs from the defaults is kept, so a default that changes (a project's
 * saved view edited on GitHub) still reaches the options the user did not touch.
 */
export function useListViewOptions<TGrouping extends string, TSort extends string>(
    params: UseListViewOptionsOptions<TGrouping, TSort>,
) {
    const store = useService(ListViewOptionsStore);
    const list = makeRef(params.list);
    const defaults = makeRef(params.defaults);
    const choices = makeRef(params.choices);
    const kept = computed(() => parseKept(store.get(list.value)));

    const options = computed((): ListViewOptions<TGrouping, TSort> => {
        const base = defaults.value;
        const allowed = choices.value;
        const { layout, grouping, sort, properties, filter } = kept.value;
        return {
            layout: layout ?? base.layout,
            grouping: allowed.groupings.find(value => value === grouping) ?? base.grouping,
            sort: allowed.sorts.find(value => value === sort) ?? base.sort,
            properties: properties ? properties.filter(value => allowed.properties.includes(value)) : base.properties,
            // A list without a filter of its own takes none.
            ...(base.filter === undefined ? {} : { filter: filter ?? base.filter }),
        };
    });
    const modified = computed(() => {
        const current = options.value;
        const base = defaults.value;
        return (
            current.layout !== base.layout ||
            current.grouping !== base.grouping ||
            current.sort !== base.sort ||
            !isSameSet(current.properties, base.properties) ||
            current.filter !== base.filter
        );
    });

    return reactive<ListViewOptionsViewModel<TGrouping, TSort>>({ options, modified, set, reset });

    function set(changes: Partial<ListViewOptions<TGrouping, TSort>>) {
        const next = { ...options.value, ...changes };
        const base = defaults.value;
        write({
            ...(next.layout === base.layout ? {} : { layout: next.layout }),
            ...(next.grouping === base.grouping ? {} : { grouping: next.grouping }),
            ...(next.sort === base.sort ? {} : { sort: next.sort }),
            ...(isSameSet(next.properties, base.properties) ? {} : { properties: next.properties }),
            ...(next.filter === base.filter ? {} : { filter: next.filter }),
        });
    }

    function reset() {
        write({});
    }

    function write(next: KeptOptions) {
        store.set(list.value, Object.keys(next).length === 0 ? null : next);
    }
}

/** What was kept, of a shape it can be; anything else is left out. */
function parseKept(value: unknown): KeptOptions {
    if (typeof value !== 'object' || value === null) {
        return {};
    }

    const layout = 'layout' in value ? LIST_LAYOUTS.find(candidate => candidate === value.layout) : undefined;
    const grouping = 'grouping' in value && typeof value.grouping === 'string' ? value.grouping : undefined;
    const sort = 'sort' in value && typeof value.sort === 'string' ? value.sort : undefined;
    const properties =
        'properties' in value && Array.isArray(value.properties)
            ? value.properties.filter((property: unknown) => typeof property === 'string')
            : undefined;
    const filter = 'filter' in value && typeof value.filter === 'string' ? value.filter : undefined;

    return {
        ...(layout ? { layout } : {}),
        ...(grouping === undefined ? {} : { grouping }),
        ...(sort === undefined ? {} : { sort }),
        ...(properties ? { properties } : {}),
        ...(filter === undefined ? {} : { filter }),
    };
}

function isSameSet(a: readonly string[], b: readonly string[]) {
    return a.length === b.length && a.every(value => b.includes(value));
}
