import type { StatusState } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import { classifyStatus } from '@/store/classifyChecks.js';

/** How a commit's CI reads: passing, failing or running. */
export type CiTone = 'danger' | 'success' | 'warning';

/**
 * The tone of a commit's checks' rollup. A commit status is never skipped; a skipped check holds nothing back, as
 * passing.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getCiTone(state: StatusState): CiTone {
    const classified = classifyStatus(state);
    switch (classified) {
        case 'passing':
        case 'skipped':
            return 'success';
        case 'failing':
            return 'danger';
        case 'pending':
            return 'warning';
        default:
            return assertNever(classified);
    }
}
