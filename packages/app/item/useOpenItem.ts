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
 * Opening an item as lists and the command menu do: over the screen in the arrangement of the one opened, else
 * the one used last (`ItemNavigation`), or on its own page. An issue being created has no number to open it by
 * yet: it is not opened.
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
        const arrangement = opened?.arrangement ?? navigation.arrangement;
        if (arrangement === 'page') {
            void router.push(getItemPagePath(reference, item.kind));
            return;
        }

        const location = { path: route.path, query: getOpenedItemQuery(route.query, reference, arrangement) };
        void (opened && options.replaceOpened ? router.replace(location) : router.push(location));
    }
}
