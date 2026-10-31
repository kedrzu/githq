import { useService } from '@nzyme/vue-ioc/useService.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { makeRef } from '@nzyme/vue-utils/reactivity/makeRef.js';
import { computed, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import type { ItemDetail } from '@/store/ItemDetailTypes.js';
import type { Item } from '@/store/ItemTypes.js';

import { ItemNavigation } from './ItemNavigation.js';
import { ItemResolver } from './ItemResolver.js';
import type { ItemReference } from './itemRoutes.js';

/** Options of {@link useOpenedItem}. */
export interface UseOpenedItemOptions {
    /** The item an address names. */
    reference: MaybeRefOrGetter<ItemReference>;
}

/** An opened item and what is known of it so far. */
export interface OpenedItemViewModel {
    /** `null` until found; also `null` when there is no such item ({@link missing}). */
    readonly id: string | null;
    /** Its row: from the local copy at once, or read with its detail. */
    readonly item: Item | null;
    /** Body, comments, checks, every project field; `null` until read. */
    readonly detail: ItemDetail | null;
    /** GitHub says there is no such item, or the user may not see it. */
    readonly missing: boolean;
}

/**
 * Opens the item an address names: finds its id (`ItemResolver`), brings its detail into memory and has it read
 * again when its row moves on (`ItemDetailStore.ensure`), and remembers it as opened last (`ItemNavigation`), for
 * the list to select when the user comes back to it.
 */
export function useOpenedItem(options: UseOpenedItemOptions): OpenedItemViewModel {
    const resolver = useService(ItemResolver);
    const details = useService(ItemDetailStore);
    const navigation = useService(ItemNavigation);

    const reference = makeRef(options.reference);
    const found = computed(() => resolver.peek(reference.value));
    const id = computed(() => found.value ?? null);
    const item = computed(() => (id.value === null ? null : (details.getItem(id.value) ?? null)));
    const detail = computed(() => (id.value === null ? null : (details.get(id.value) ?? null)));

    watch(
        reference,
        next => {
            if (resolver.peek(next) === undefined) {
                void resolver.resolve(next);
            }
        },
        { immediate: true },
    );

    // Opened, and its row moved on since (a poll read it again): its detail is read again.
    watch(
        () => [id.value, item.value?.updatedAt] as const,
        ([current]) => {
            if (current !== null) {
                navigation.setLastOpened(current);
                void details.ensure(current);
            }
        },
        { immediate: true },
    );

    return reactive<OpenedItemViewModel>({
        id,
        item,
        detail,
        missing: computed(() => found.value === null),
    });
}
