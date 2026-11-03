import { assertNever } from '@nzyme/utils/assertNever.js';
import { CircleCheck, CircleSlash, CircleX, Loader } from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';

import type { ItemCheckState } from '@/store/ItemDetailTypes.js';

/**
 * The icon of a check, or of checks summed up, in this state: as the opened item's checks and standing, and the merge
 * panel, draw it (PM4a, PM38).
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getCheckIcon(state: ItemCheckState): LucideIcon {
    switch (state) {
        case 'failing':
            return CircleX;
        case 'pending':
            return Loader;
        case 'passing':
            return CircleCheck;
        case 'skipped':
            return CircleSlash;
        default:
            return assertNever(state);
    }
}
