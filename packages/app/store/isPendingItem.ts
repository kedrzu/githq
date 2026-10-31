import type { Item } from './ItemTypes.js';

/**
 * Whether the item is an issue being created, not numbered by GitHub yet: it is shown as `#…` and cannot be
 * opened. GitHub's numbers start at 1; the issue drawn before GitHub answers has 0.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isPendingItem(item: Item) {
    return item.number === 0;
}
