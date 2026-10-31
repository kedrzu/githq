import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed } from 'vue';

import { ITEM_PROPERTIES } from './ItemProperty.js';
import * as propertyLabels from './ItemProperty.loc.js';
import { ITEM_SORTS } from './ItemSort.js';
import type { ItemSort } from './ItemSort.js';
import * as sortLabels from './ItemSort.loc.js';
import type { ListChoice } from './ListTypes.js';

/**
 * The orders and properties a list of issues and pull requests offers in its display options, named — my work's
 * and a repository's.
 */
export function useItemListChoices() {
    const t = useTranslate();

    const sorts = computed((): ListChoice<ItemSort>[] =>
        ITEM_SORTS.map(sort => ({ value: sort, label: t(sortLabels[sort]) })),
    );
    const properties = computed((): ListChoice[] =>
        ITEM_PROPERTIES.map(property => ({ value: property, label: t(propertyLabels[property]) })),
    );

    return { sorts, properties };
}
