import { isPendingItem } from '@/store/isPendingItem.js';
import type { Item } from '@/store/ItemTypes.js';

import { getItemReference } from './itemRoutes.js';
import { useOpenItemReference } from './useOpenItemReference.js';
import type { OpenItemOptions } from './useOpenItemReference.js';

/**
 * Opening an item as lists and the command menu do: where the one opened is shown — its own page, or the panel beside
 * the screen — else in the panel over a list whose window has room for it, on its page anywhere else
 * (`useOpenItemReference`). An issue being created has no number to open it by yet: it is not opened.
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
