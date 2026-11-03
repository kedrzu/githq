import { useService } from '@nzyme/vue-ioc/useService.js';
import { useRoute, useRouter } from 'vue-router';

import type { Item } from '@/store/ItemTypes.js';

import { ItemNavigation } from './ItemNavigation.js';
import { getItemPagePath, getOpenedItemQuery, getOpenedItemRoute } from './itemRoutes.js';
import type { ItemReference } from './itemRoutes.js';

/** How an item is opened, by {@link useOpenItemReference}'s function and `useOpenItem`'s. */
export interface OpenItemOptions {
    /**
     * With an item opened over the screen already, the new one takes its place in the history instead of adding to
     * it: stepping through a list.
     */
    readonly replaceOpened?: boolean;
}

/**
 * `useOpenItem` for an item known by its address and kind, which the local copy may not hold: a commit's pull
 * request, in whichever repository it is.
 */
export function useOpenItemReference() {
    const navigation = useService(ItemNavigation);
    const route = useRoute();
    const router = useRouter();

    return openItemReference;

    function openItemReference(reference: ItemReference, kind: Item['kind'], options: OpenItemOptions = {}) {
        const opened = getOpenedItemRoute(route);
        // An item opened already keeps where it is shown; else the remembered arrangement decides.
        if (opened ? opened.onPage : navigation.arrangement === 'page') {
            void router.push(getItemPagePath(reference, kind));
            return;
        }

        const location = { path: route.path, query: getOpenedItemQuery(route.query, reference) };
        void (opened && options.replaceOpened ? router.replace(location) : router.push(location));
    }
}
