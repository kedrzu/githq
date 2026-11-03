import { assertNever } from '@nzyme/utils/assertNever.js';
import { CircleHelp, CircleX, TriangleAlert } from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';

import type { MergeEnd } from './MergeTypes.js';

/** How the end of a merge that did not end merged looks, wherever it is said. */
export interface MergeEndLook {
    readonly tone: 'danger' | 'muted' | 'warning';
    readonly icon: LucideIcon;
}

/**
 * The tone and icon of a merge's end (PM25, PM27–PM29, PM37, PM38), the same in the merge panel, the opened item's
 * standing and the rows: refused in red, a new commit in amber, no answer in grey. The words stay each place's own.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getMergeEndLook(kind: MergeEnd['kind']): MergeEndLook {
    switch (kind) {
        case 'refused':
        case 'methodNotAllowed':
            return { tone: 'danger', icon: CircleX };
        case 'headMoved':
            return { tone: 'warning', icon: TriangleAlert };
        case 'unknown':
            return { tone: 'muted', icon: CircleHelp };
        default:
            return assertNever(kind);
    }
}
