import { useService } from '@nzyme/vue-ioc/useService.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { EditQueue } from '@/edits/EditQueue.js';
import { useEditTexts } from '@/edits/useEditTexts.js';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import type { ItemReturnRequest } from '@/item/ItemNavigation.js';
import { ItemResolver } from '@/item/ItemResolver.js';
import { getOpenedItemQuery, getOpenedItemRoute } from '@/item/itemRoutes.js';
import { useOpenItem } from '@/item/useOpenItem.js';
import { useNow } from '@/services/useNow.js';
import { ItemOverlay } from '@/store/ItemOverlay.js';
import { ItemStore } from '@/store/ItemStore.js';

import type { ListedItems } from './ListTypes.js';

/** How often the rows' ages ("12m") move on. */
const AGE_TICK_MS = 30_000;

/** A list page's selection and the item opened from it. */
export interface ItemListViewModel {
    /** The selected item's id; at first the item opened last, which the list selects when it comes back. */
    selectedId: string | null;
    /** The items edited together (`x`). */
    checkedIds: readonly string[];
    /** The item opened over the list, in the panel, once the address's reference is resolved. */
    readonly openedId: string | null;
    /** What was just undone of an item's edits, by its id ("“regression” label undone"). */
    readonly undone: ReadonlyMap<string, string>;
    /** Epoch ms the rows' ages are counted to; moves on every half a minute. */
    readonly now: number;
    /** The user has an edit of the item on its way (`EditQueue`). */
    isEdited(id: string): boolean;
    /** Opens the item in the arrangement used last, or in place of the one open. */
    open(id: string): void;
    /** The items the list shows, and what an opened item steps through. */
    setListed(listed: ListedItems): void;
}

/**
 * What every list page does with items (my work, a repository, a project): an item opens in the arrangement
 * used last (`ItemNavigation`); one opened over the list (`?pane=issue&issue=…`) is the selected row, and the
 * selection moving opens the next item in its place; coming back from an item's page, the item is selected. A toast's
 * request to select the items that failed (K2) selects those the list shows, and an Undo of a close (D29) brings the
 * selection, and an item open, back to the undone item the list shows.
 */
export function useItemList(): ItemListViewModel {
    const items = useService(ItemStore);
    const navigation = useService(ItemNavigation);
    const resolver = useService(ItemResolver);
    const queue = useService(EditQueue);
    const overlay = useService(ItemOverlay);
    const editTexts = useEditTexts();
    const openItem = useOpenItem();
    const route = useRoute();
    const router = useRouter();

    const selectedId = ref<string | null>(navigation.lastOpenedId);
    const checkedIds = ref<readonly string[]>([]);
    const listed = shallowRef<ListedItems>({ all: [], steps: [], stepOf: new Map(), around: null });
    const now = useNow(AGE_TICK_MS);
    /** The Undo of a close whose rows are still to come back; `null` once one is back or GitHub answered. */
    let returning: ItemReturnRequest | null = null;

    const listPath = computed(
        () => router.resolve({ path: route.path, query: getOpenedItemQuery(route.query, null) }).fullPath,
    );
    const opened = computed(() => {
        const found = getOpenedItemRoute(route);
        return found && !found.onPage ? found : null;
    });
    const openedId = computed(() => (opened.value ? (resolver.peek(opened.value.reference) ?? null) : null));
    const undone = computed(() => {
        const texts = new Map<string, string>();
        for (const [id, subject] of queue.undone) {
            texts.set(id, editTexts.undone(subject));
        }

        return texts;
    });

    // The opened item is the selected row — also one the address opens as the page loads (a reload).
    watch(
        openedId,
        id => {
            if (id !== null) {
                selectedId.value = id;
            }
        },
        { immediate: true },
    );

    // A toast asked for the items that failed of a change of several (K2): those the list shows are selected alone.
    watch(
        () => navigation.selectionRequest,
        request => {
            const ids = request?.ids.filter(id => listed.value.all.includes(id)) ?? [];
            if (ids.length > 0) {
                checkedIds.value = ids;
            }
        },
    );

    // An Undo of a close: taken as it is asked, as the list may hand over its row in the same flush as the layer lands.
    watch(
        () => navigation.returnRequest,
        request => {
            returning = request;
            void request?.settled.finally(() => {
                if (returning === request) {
                    returning = null;
                }
            });
        },
        { flush: 'sync' },
    );

    // Decided only on what the list hands over once it caught up with the layer: the cursor goes to the first of the undone
    // items in the list's order, the checked items untouched, and a list that doesn't show them moves nothing.
    watch(listed, ({ all }) => {
        const id = all.find(candidate => returning?.ids.includes(candidate));
        if (id !== undefined) {
            returning = null;
            selectedId.value = id;
            if (opened.value) {
                open(id);
            }
        }
    });

    // What an opened item steps through, and where closing it comes back to: on every move of the cursor.
    watch(
        [listed, listPath],
        ([{ steps, stepOf, around }, path]) => navigation.setList({ path, steps, stepOf, around }),
        { immediate: true },
    );

    // The list stays what an opened item steps through; its cursor goes with it.
    onBeforeUnmount(() => {
        if (navigation.list) {
            navigation.setList({ ...navigation.list, around: null });
        }
    });

    // An issue created under a temporary id: the selection follows it to the id GitHub gave it.
    watch(
        () =>
            [
                selectedId.value === null ? null : followConfirmed(selectedId.value),
                checkedIds.value.map(id => followConfirmed(id)),
            ] as const,
        ([selected, checked]) => {
            if (selected !== selectedId.value) {
                selectedId.value = selected;
            }

            if (checked.some((id, index) => id !== checkedIds.value[index])) {
                checkedIds.value = checked;
            }
        },
    );

    return reactive<ItemListViewModel>({ selectedId, checkedIds, openedId, undone, now, isEdited, open, setListed });

    function followConfirmed(id: string) {
        return overlay.getConfirmedId(id) ?? id;
    }

    function isEdited(id: string) {
        return queue.pending.some(edit => edit.itemId === id);
    }

    function open(id: string) {
        const item = items.get(id);
        if (item) {
            // Asked for even when it is the opened one, as a step back to it overtakes a step still on its way. Moving
            // from one opened item to the next replaces it; opening the first adds to the history.
            openItem(item, { replaceOpened: true });
        }
    }

    function setListed(value: ListedItems) {
        listed.value = value;
    }
}
