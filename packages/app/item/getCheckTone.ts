import { assertNever } from '@nzyme/utils/assertNever.js';

import type { ItemCheckState } from '@/store/ItemDetailTypes.js';

import type { PullRequestVerdictTone } from './usePullRequestVerdict.js';

/**
 * The tone of a check, or of checks summed up, in this state: as the opened item's standing and the merge panel
 * colour it.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getCheckTone(state: ItemCheckState): PullRequestVerdictTone {
    switch (state) {
        case 'failing':
            return 'danger';
        case 'pending':
            return 'warning';
        case 'passing':
            return 'success';
        case 'skipped':
            return 'muted';
        default:
            return assertNever(state);
    }
}
