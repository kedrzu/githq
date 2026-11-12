import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef } from 'vue';

import type { ListedItems } from '@/lists/ListTypes.js';

/** The list items are opened from: where it is, and what `K`/`J` step through. */
export interface ItemList extends Omit<ListedItems, 'all'> {
    /** The list's address, query included (`/issues/assigned?…`): where closing an item goes back to. */
    readonly path: string;
}

/** A step of `K`/`J` from one pull request's review to another's. */
export interface ReviewWalk {
    /** Where to, as `formatItemReference` writes it. */
    readonly to: string;
    /** The number of the pull request left. */
    readonly from: number;
    /** The key that goes back. */
    readonly back: 'J' | 'K';
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

/** The opened item staying where a step would have taken it from: an edit there with changes asks first. */
export interface ItemStayRequest {
    readonly id: string;
}

/** An Undo of a close, asking the cursor back to what it reopens (D29). */
export interface ItemReturnRequest {
    /** The items reopened, in the order they were closed in. */
    readonly ids: readonly string[];
    /** Done once GitHub answered: a row not back by then isn't coming, and the request lapses. */
    readonly settled: Promise<unknown>;
}

/**
 * What opening items carries from one moment to the next, shared by the lists and the item view: whether the
 * window has room for the panel beside the screen — an item opens there when it has, on its page when it hasn't —
 * the list they are opened from, the item opened last, which the list selects
 * when it comes back, the items a toast asks the list to select, a merge sent from the panel asking it to move on, an Undo of a close asking the cursor back, the opened item staying where a step would have left it, the item whose comment box takes the cursor
 * once it opens ("Comment" in a list's context menu), the step a review is being walked by, for the next to say, and a review asked to open at its submit dialog.
 */
export type ItemNavigation = Resolved<typeof ItemNavigation>;
export const ItemNavigation = defineService({
    name: 'ItemNavigation',
    setup() {
        // Until the shell has measured the window, there is room: most windows have it.
        const panelFitsRef = shallowRef(true);
        const listRef = shallowRef<ItemList | null>(null);
        const lastOpenedRef = shallowRef<string | null>(null);
        const selectionRequestRef = shallowRef<ItemSelectionRequest | null>(null);
        const moveOnRequestRef = shallowRef<ItemMoveOnRequest | null>(null);
        const returnRequestRef = shallowRef<ItemReturnRequest | null>(null);
        const stayRequestRef = shallowRef<ItemStayRequest | null>(null);
        const commentRequestRef = shallowRef<string | null>(null);
        let reviewWalk: ReviewWalk | null = null;
        let reviewToSubmit: string | null = null;

        return {
            /**
             * Whether the window holds the panel beside the screen and the sidebar, each at its minimum width
             * (`AppShell`); `true` until the shell says. Reactive.
             */
            get panelFits() {
                return panelFitsRef.value;
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
            /** The opened item staying put last, for the list's cursor to come back to it; a new object for every request. Reactive. */
            get stayRequest() {
                return stayRequestRef.value;
            },
            /** The id of the item whose comment box takes the cursor once it opens; reactive. */
            get commentRequest() {
                return commentRequestRef.value;
            },
            setPanelFits,
            setList,
            setLastOpened,
            requestSelection,
            requestMoveOn,
            requestReturn,
            requestStay,
            requestComment,
            noteReviewWalk,
            takeReviewWalk,
            noteReviewSubmit,
            takeReviewSubmit,
        };

        function setPanelFits(fits: boolean) {
            panelFitsRef.value = fits;
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

        function requestStay(id: string) {
            stayRequestRef.value = { id };
        }

        /** `null` once the item opened took it. */
        function requestComment(id: string | null) {
            commentRequestRef.value = id;
        }

        function noteReviewWalk(walk: ReviewWalk) {
            reviewWalk = walk;
        }

        /** The step that brought a review here, once: on a next open it came some other way. */
        function takeReviewWalk(to: string) {
            const walk = reviewWalk?.to === to ? reviewWalk : null;
            reviewWalk = null;
            return walk;
        }

        /** The review about to open is to open at its submit dialog (CR34); by its reference, as `formatItemReference` writes it. */
        function noteReviewSubmit(reference: string) {
            reviewToSubmit = reference;
        }

        /** Whether the review was opened to submit it, once. */
        function takeReviewSubmit(reference: string) {
            const asked = reviewToSubmit === reference;
            reviewToSubmit = null;
            return asked;
        }
    },
});
