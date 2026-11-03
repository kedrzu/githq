import { isPendingItem } from '@/store/isPendingItem.js';
import type { Item } from '@/store/ItemTypes.js';

import { getItemReference } from './itemRoutes.js';
import { useOpenItemReference } from './useOpenItemReference.js';
import type { OpenItemOptions } from './useOpenItemReference.js';

/**
 * Opening an item as lists and the command menu do: where the one opened is shown — its own page, or over the
 * screen's list — else where the arrangement remembered in this browser says (`ItemNavigation`). Over a list it
 * shows in the panel or the modal the browser remembers, which the address does not say. An issue being created has no number to open it by yet: it is not opened.
 */
export function useOpenItem() {
    const openItemReference = useOpenItemReference();

    return openItem;

    function openItem(item: Item, options: OpenItemOptions = {}) {
        if (!isPendingItem(item)) {
            openItemReference(getItemReference(item), item.kind, options);
        }
    }
}
