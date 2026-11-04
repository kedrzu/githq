import { useService } from '@nzyme/vue-ioc/useService.js';
import { makeRef } from '@nzyme/vue-utils/reactivity/makeRef.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { computed } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import { ItemNavigation } from './ItemNavigation.js';
import type { StackNeighbours } from './StackMap.vue';

/** Options of {@link useItemWalk}. */
export interface UseItemWalkOptions {
    /** The id of the item the walk is at; `null` until found. */
    id: MaybeRefOrGetter<string | null>;
    /** Which of the list's items the walk stops at; left out, every one. */
    stopsAt?: (id: string) => boolean;
}

/** Where an item is in the list it was opened from: "3 / 13". */
export interface ItemWalkPosition {
    /** From 1. */
    readonly index: number;
    readonly count: number;
}

/** Where `K`/`J` go from an item, and how far along it is. */
export interface ItemWalkViewModel {
    /** `null` with no list, or outside it (an item opened by its address). */
    readonly position: ItemWalkPosition | null;
    /** Both `null` wherever {@link position} is: the keys do nothing there. */
    readonly neighbours: StackNeighbours;
}

/**
 * The walk through the list an item was opened from (`ItemNavigation.list`), the same in an opened item and in a
 * pull request's review: the list's order, so the last of one stack is followed by the first of the next (stacked PRs
 * D9), and the end of a stack no special case.
 */
export function useItemWalk(options: UseItemWalkOptions): ItemWalkViewModel {
    const navigation = useService(ItemNavigation);

    const id = makeRef(options.id);
    const ids = computed(() => {
        const listed = navigation.list?.ids ?? [];
        return options.stopsAt ? listed.filter(options.stopsAt) : listed;
    });
    const index = computed(() => (id.value === null ? -1 : ids.value.indexOf(id.value)));

    return reactive<ItemWalkViewModel>({
        position: computed(() => (index.value === -1 ? null : { index: index.value + 1, count: ids.value.length })),
        neighbours: computed(() =>
            index.value === -1
                ? { previous: null, next: null }
                : { previous: ids.value[index.value - 1] ?? null, next: ids.value[index.value + 1] ?? null },
        ),
    });
}
