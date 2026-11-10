import { defineContext } from '@nzyme/vue-utils/context.js';

import type { ItemReference } from './itemRoutes.js';

/**
 * How a link to an item in GitHub's HTML (`shell/GitHubLinks.vue`) opens it: an opened item provides it, so the item
 * linked opens as it does — in the same panel, modal or page, the list kept behind. Where nobody provides it (the
 * review, Settings, a story) the link goes to the item's address.
 */
export interface ItemLinkContext {
    /**
     * Opens the item linked, at the fragment the link names (`#issuecomment-5`, `''` for none): the place in the item
     * it points to stays in the address.
     */
    open(reference: ItemReference, hash: string): void;
}

export const ItemLinkContext = defineContext<ItemLinkContext>('ItemLinkContext');
