import { assertNever } from '@nzyme/utils/assertNever.js';

import type { Item } from '@/store/ItemTypes.js';
import { compareText } from '@/utils/compareText.js';

import type { ItemSort } from './ItemSort.js';

/**
 * Compares two items for `sort`; ties broken by id, so the order never changes between renders.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getItemComparator(sort: ItemSort): (a: Item, b: Item) => number {
    return (a, b) => compareBy(sort, a, b) || compareText(a.id, b.id);
}

function compareBy(sort: ItemSort, a: Item, b: Item): number {
    switch (sort) {
        case 'updated':
            return compareText(b.updatedAt, a.updatedAt);
        case 'created':
            return compareText(b.createdAt, a.createdAt);
        case 'number':
            // Newest first, as GitHub lists them; across repositories by repository first.
            return compareText(a.repository.nameWithOwner, b.repository.nameWithOwner) || b.number - a.number;
        case 'title':
            return a.title.localeCompare(b.title);
        default:
            return assertNever(sort);
    }
}
