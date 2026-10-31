import type { Item } from './ItemTypes.js';

/**
 * Whether `incoming` is an older copy of the row than `held`, so it must not replace it: GitHub changed the item
 * since it was read, or the user's edit GitHub confirmed meanwhile ({@link Item.confirmation}) is not in it yet —
 * every time it holds, the item's and its project places', is before the edit. `now` is epoch ms.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isOlderCopy(incoming: Item, held: Item, now: number): boolean {
    if (incoming.updatedAt < held.updatedAt) {
        return true;
    }

    const { confirmation } = held;
    return confirmation !== undefined && now < confirmation.until && getNewestTime(incoming) < confirmation.at;
}

/** The newest of the times a copy holds: when it was read, GitHub had changed nothing of it after that. */
function getNewestTime(item: Item) {
    let newest = item.confirmation?.at ?? item.updatedAt;
    for (const time of [item.updatedAt, ...item.projects.map(place => place.updatedAt)]) {
        if (time > newest) {
            newest = time;
        }
    }

    return newest;
}
