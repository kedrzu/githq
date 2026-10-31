import { useService } from '@nzyme/vue-ioc/useService.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { computed, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { EditQueue } from '@/edits/EditQueue.js';
import { useEditTexts } from '@/edits/useEditTexts.js';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import { ItemResolver } from '@/item/ItemResolver.js';
import { getOpenedItemQuery, getOpenedItemRoute } from '@/item/itemRoutes.js';
import { useOpenItem } from '@/item/useOpenItem.js';
import { useNow } from '@/services/useNow.js';
import { ItemOverlay } from '@/store/ItemOverlay.js';
import { ItemStore } from '@/store/ItemStore.js';

/** How often the rows' ages ("12m") move on. */
const AGE_TICK_MS = 30_000;

/** A list page's selection and the item opened from it. */
export interface ItemListViewModel {
    /** The selected item's id; at first the item opened last, which the list selects when it comes back. */
    selectedId: string | null;
    /** The items edited together (`x`). */
    checkedIds: readonly string[];
    /** The item opened over the list (panel or modal), once the address's reference is resolved. */
    readonly openedId: string | null;
    /** What was just undone of an item's edits, by its id ("“regression” label undone"). */
    readonly undone: ReadonlyMap<string, string>;
    /** Epoch ms the rows' ages are counted to; moves on every half a minute. */
    readonly now: number;
    /** Opens the item in the arrangement used last, or in place of the one open. */
    open(id: string): void;
    /** The items the list shows, top to bottom: what an opened item steps through. */
    setListed(ids: readonly string[]): void;
}

/**
 * What every list page does with items (my work, a repository, a project): an item opens in the arrangement
 * used last (`ItemNavigation`); one opened over the list (`?pane=issue&issue=…`) is the selected row, and the
 * selection moving opens the next item in its place; coming back from an item's page, the item is selected. A toast's
 * request to select the items that failed (K2) selects those the list shows.
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
    const listed = shallowRef<readonly string[]>([]);
    const now = useNow(AGE_TICK_MS);

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
            const ids = request?.ids.filter(id => listed.value.includes(id)) ?? [];
            if (ids.length > 0) {
                checkedIds.value = ids;
            }
        },
    );

    // What an opened item steps through, and where closing it comes back to.
    watch(
        [listed, () => route.fullPath],
        ([ids]) => {
            const path = router.resolve({ path: route.path, query: getOpenedItemQuery(route.query, null) }).fullPath;
            navigation.setList({ path, ids });
        },
        { immediate: true },
    );

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

    return reactive<ItemListViewModel>({ selectedId, checkedIds, openedId, undone, now, open, setListed });

    function followConfirmed(id: string) {
        return overlay.getConfirmedId(id) ?? id;
    }

    function open(id: string) {
        const item = items.get(id);
        if (item && id !== openedId.value) {
            // Moving from one opened item to the next replaces it; opening the first adds to the history.
            openItem(item, { replaceOpened: true });
        }
    }

    function setListed(ids: readonly string[]) {
        listed.value = ids;
    }
}
