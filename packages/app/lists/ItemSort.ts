/** How a list of issues and pull requests is ordered: last update or creation newest first, number, title. */
export type ItemSort = 'created' | 'number' | 'title' | 'updated';

/** The orders in the order the display options show them. */
export const ITEM_SORTS: readonly ItemSort[] = ['updated', 'created', 'number', 'title'];
