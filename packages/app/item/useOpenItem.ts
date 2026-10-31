import { useService } from '@nzyme/vue-ioc/useService.js';
import { useRoute, useRouter } from 'vue-router';

import { isPendingItem } from '@/store/isPendingItem.js';
import type { Item } from '@/store/ItemTypes.js';

import { ItemNavigation } from './ItemNavigation.js';
import { getItemPagePath, getItemReference, getOpenedItemQuery, getOpenedItemRoute } from './itemRoutes.js';

/** How {@link useOpenItem}'s function opens an item. */
export interface OpenItemOptions {
    /**
     * With an item opened over the screen already, the new one takes its place in the history instead of adding to
     * it: stepping through a list.
     */
    readonly replaceOpened?: boolean;
}

/**
 * Opening an item as lists and the command menu do: where the one opened is shown — its own page, or over the
 * screen's list — else where the arrangement remembered in this browser says (`ItemNavigation`). Over a list it
 * shows in the panel or the modal the browser remembers, which the address does not say. An issue being created has no number to open it by yet: it is not opened.
 */
export function useOpenItem() {
    const navigation = useService(ItemNavigation);
    const route = useRoute();
    const router = useRouter();

    return openItem;

    function openItem(item: Item, options: OpenItemOptions = {}) {
        if (isPendingItem(item)) {
            return;
        }

        const reference = getItemReference(item);
        const opened = getOpenedItemRoute(route);
        // An item opened already keeps where it is shown; else the remembered arrangement decides.
        if (opened ? opened.onPage : navigation.arrangement === 'page') {
            void router.push(getItemPagePath(reference, item.kind));
            return;
        }

        const location = { path: route.path, query: getOpenedItemQuery(route.query, reference) };
        void (opened && options.replaceOpened ? router.replace(location) : router.push(location));
    }
}
