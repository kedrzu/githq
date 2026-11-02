import type { Item, ItemUser } from '@/store/ItemTypes.js';

/** Whose faces {@link getItemPeople} gives. */
export interface GetItemPeopleParams {
    readonly item: Item;
    /** Who opened it (my work, where it is the user's own work), or who it is assigned to. */
    readonly shown: 'assignees' | 'author';
    /** The signed-in user: their own items show no author. */
    readonly viewerLogin: string | null;
}

/**
 * The people a row shows for an item: its assignees, or its author unless that is the user.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getItemPeople(params: GetItemPeopleParams): readonly ItemUser[] {
    const { item } = params;
    if (params.shown === 'assignees') {
        return item.assignees;
    }

    return item.author && item.author.login !== params.viewerLogin ? [item.author] : [];
}
