import { ITEM_PROPERTIES } from '@/lists/ItemProperty.js';
import type { ItemSort } from '@/lists/ItemSort.js';
import { ITEM_SORTS } from '@/lists/ItemSort.js';
import type { ListViewChoices } from '@/lists/useListViewOptions.js';
import type { ListViewOptions } from '@/lists/ListTypes.js';

/** My work is grouped by why each item is the user's (D11), or by repository (D22). */
export type MyWorkGrouping = 'reason' | 'repository';

/** How my work is shown until the user changes it on this device: a list by reason, newest first (D11). */
export const MY_WORK_VIEW_DEFAULTS: ListViewOptions<MyWorkGrouping, ItemSort> = {
    layout: 'list',
    grouping: 'reason',
    sort: 'updated',
    properties: ['status', 'projectField', 'labels', 'people', 'size', 'updated'],
};

/** What my work's view options may be set to. */
export const MY_WORK_VIEW_CHOICES: ListViewChoices<MyWorkGrouping, ItemSort> = {
    groupings: ['reason', 'repository'],
    sorts: ITEM_SORTS,
    properties: ITEM_PROPERTIES,
};
