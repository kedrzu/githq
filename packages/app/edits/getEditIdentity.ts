import type { Item } from '@/store/ItemTypes.js';

import type { EditSubject } from './EditTypes.js';

/** What every edit of an item says of it: which it is, as named to the user, and what changes. */
export function getEditIdentity(item: Item, subject: EditSubject) {
    return { itemId: item.id, reference: `${item.repository.nameWithOwner}#${item.number}`, subject };
}
