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
    /**
     * Whether the keys reach what the list's cursor is next to rather than the item's own steps, told whether the item has
     * a step in the list; left out, never: a list's cursor means nothing where the list isn't beside the item.
     */
    followsCursor?: (listed: boolean) => boolean;
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
    /** What `K`/`J` reach. Both `null` wherever {@link position} is, unless they follow the list's cursor. */
    readonly neighbours: StackNeighbours;
    /** The steps either side of the item, or of the entry that stands for it, whatever the cursor. */
    readonly stepNeighbours: StackNeighbours;
}

/**
 * The walk through the list an item was opened from (`ItemNavigation.list`), the same in an opened item and in a
 * pull request's review: the list's order, so the last of one stack is followed by the first of the next (stacked PRs
 * D9), and the end of a stack no special case.
 */
export function useItemWalk(options: UseItemWalkOptions): ItemWalkViewModel {
    const navigation = useService(ItemNavigation);

    const id = makeRef(options.id);
    const steps = computed(() => {
        const listed = navigation.list?.steps ?? [];
        return options.stopsAt ? listed.filter(options.stopsAt) : listed;
    });
    const index = computed(() =>
        id.value === null ? -1 : steps.value.indexOf(navigation.list?.stepOf.get(id.value) ?? id.value),
    );
    const stepNeighbours = computed(
        (): StackNeighbours =>
            index.value === -1
                ? { previous: null, next: null }
                : { previous: steps.value[index.value - 1] ?? null, next: steps.value[index.value + 1] ?? null },
    );

    return reactive<ItemWalkViewModel>({
        position: computed(() => (index.value === -1 ? null : { index: index.value + 1, count: steps.value.length })),
        neighbours: computed(
            () =>
                (options.followsCursor?.(index.value !== -1) && navigation.list?.around) || stepNeighbours.value,
        ),
        stepNeighbours,
    });
}
