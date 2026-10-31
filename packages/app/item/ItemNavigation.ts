import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef } from 'vue';

import { LocalPreferences } from '@/services/LocalPreferences.js';

import type { ItemArrangement } from './itemRoutes.js';

/** The list items are opened from: where it is, and its items top to bottom as it shows them. */
export interface ItemList {
    /** The list's address, query included (`/issues/assigned?…`): where closing an item goes back to. */
    readonly path: string;
    /** The ids of the items it shows, in its order: what `K`/`J` step through. */
    readonly ids: readonly string[];
}

/** Items a list is asked to select alone — the failed ones of a change of several (K2). */
export interface ItemSelectionRequest {
    readonly ids: readonly string[];
}

/**
 * What opening items carries from one moment to the next, shared by the lists and the item view: the
 * arrangement items open in — the one used last, remembered in this browser (D9: one of the app's three
 * independent switches) — the list they are opened from, the item opened last, which the list selects
 * when it comes back, and the items a toast asks the list to select.
 */
export type ItemNavigation = Resolved<typeof ItemNavigation>;
export const ItemNavigation = defineService({
    name: 'ItemNavigation',
    deps: {
        preferences: LocalPreferences,
    },
    setup({ preferences }) {
        const listRef = shallowRef<ItemList | null>(null);
        const lastOpenedRef = shallowRef<string | null>(null);
        const selectionRequestRef = shallowRef<ItemSelectionRequest | null>(null);

        return {
            /** The arrangement an item opens in; reactive. */
            get arrangement() {
                return preferences.itemArrangement.value;
            },
            /**
             * How an item opened over a list shows: in the modal when that is the arrangement remembered, else in
             * the panel — a remembered `page` too, for the address opens it over the list. Reactive.
             */
            get listArrangement(): Exclude<ItemArrangement, 'page'> {
                return preferences.itemArrangement.value === 'modal' ? 'modal' : 'panel';
            },
            /** The list shown last; `null` before any (an item's page opened by its address). Reactive. */
            get list() {
                return listRef.value;
            },
            /** The item opened last; reactive. */
            get lastOpenedId() {
                return lastOpenedRef.value;
            },
            /** The items asked to be selected last; a new object for every request. Reactive. */
            get selectionRequest() {
                return selectionRequestRef.value;
            },
            setArrangement,
            setList,
            setLastOpened,
            requestSelection,
        };

        function setArrangement(arrangement: ItemArrangement) {
            preferences.itemArrangement.value = arrangement;
        }

        function setList(list: ItemList) {
            listRef.value = list;
        }

        function setLastOpened(id: string) {
            lastOpenedRef.value = id;
        }

        function requestSelection(ids: readonly string[]) {
            selectionRequestRef.value = { ids };
        }
    },
});
