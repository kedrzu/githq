import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef } from 'vue';

import type { ListedItems } from '@/lists/ListTypes.js';
import { LocalPreferences } from '@/services/LocalPreferences.js';

import type { ItemArrangement } from './itemRoutes.js';

/** The list items are opened from: where it is, and what `K`/`J` step through. */
export interface ItemList extends Omit<ListedItems, 'all'> {
    /** The list's address, query included (`/issues/assigned?…`): where closing an item goes back to. */
    readonly path: string;
}

/** Items a list is asked to select alone — the failed ones of a change of several (K2). */
export interface ItemSelectionRequest {
    readonly ids: readonly string[];
}

/** A merge sent from the item opened in the panel, for the list to move past (PM32a). */
export interface ItemMoveOnRequest {
    /** The pull requests the merge took: the opened one, or a stack's up to it. */
    readonly merged: readonly string[];
}

/** An Undo of a close, asking the cursor back to what it reopens (D29). */
export interface ItemReturnRequest {
    /** The items reopened, in the order they were closed in. */
    readonly ids: readonly string[];
    /** Done once GitHub answered: a row not back by then isn't coming, and the request lapses. */
    readonly settled: Promise<unknown>;
}

/**
 * What opening items carries from one moment to the next, shared by the lists and the item view: the
 * arrangement items open in — the one used last, remembered in this browser (D9: one of the app's three
 * independent switches) — the list they are opened from, the item opened last, which the list selects
 * when it comes back, the items a toast asks the list to select, a merge sent from the panel asking it to move on, an Undo of a close asking the cursor back, and the item whose comment box takes the cursor
 * once it opens ("Comment" in a list's context menu).
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
        const moveOnRequestRef = shallowRef<ItemMoveOnRequest | null>(null);
        const returnRequestRef = shallowRef<ItemReturnRequest | null>(null);
        const commentRequestRef = shallowRef<string | null>(null);

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
            /** The merge asking the list to move on last; a new object for every request. Reactive. */
            get moveOnRequest() {
                return moveOnRequestRef.value;
            },
            /** The Undo of a close asking the cursor back last; a new object for every request. Reactive. */
            get returnRequest() {
                return returnRequestRef.value;
            },
            /** The id of the item whose comment box takes the cursor once it opens; reactive. */
            get commentRequest() {
                return commentRequestRef.value;
            },
            setArrangement,
            setList,
            setLastOpened,
            requestSelection,
            requestMoveOn,
            requestReturn,
            requestComment,
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

        function requestMoveOn(merged: readonly string[]) {
            moveOnRequestRef.value = { merged };
        }

        function requestReturn(request: ItemReturnRequest) {
            returnRequestRef.value = request;
        }

        /** `null` once the item opened took it. */
        function requestComment(id: string | null) {
            commentRequestRef.value = id;
        }
    },
});
