import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';

import { PhoneLayout } from '@/shell/PhoneLayout.js';

import type { ListLayout } from './ListTypes.js';

/**
 * The layout a list is drawn in, from the one its options keep: on a phone always the list (mobile D9), the kept layout
 * left as it is, so the board comes back once the window widens. What depends on what is drawn (the engine's layout, a
 * board's every column, a note that stands over the columns) reads this; what depends on the choice itself (a board's
 * columns as its grouping, the layout control) reads the options.
 *
 * @util
 */
export function useShownLayout(layout: MaybeRefOrGetter<ListLayout>): ComputedRef<ListLayout> {
    const phone = useService(PhoneLayout);
    return computed(() => (phone.active ? 'list' : toValue(layout)));
}
