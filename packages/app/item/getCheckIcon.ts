import { assertNever } from '@nzyme/utils/assertNever.js';
import { CircleCheck, CircleSlash, CircleX, LoaderCircle } from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';

import type { ItemCheckState } from '@/store/ItemDetailTypes.js';

/**
 * The icon of a check in this state, as the opened item's and the merge panel's lists draw it.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getCheckIcon(state: ItemCheckState): LucideIcon {
    switch (state) {
        case 'failing':
            return CircleX;
        case 'pending':
            return LoaderCircle;
        case 'passing':
            return CircleCheck;
        case 'skipped':
            return CircleSlash;
        default:
            return assertNever(state);
    }
}
