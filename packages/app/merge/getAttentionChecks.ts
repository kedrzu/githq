import { compareChecks } from '@/item/compareChecks.js';

import { isHoldingCheck } from './isHoldingCheck.js';
import type { MergeCheck } from './MergeTypes.js';

/**
 * The checks shown as rows while the list is folded: any required one failing or running, with those that aren't
 * required failing or running beside them; else only those that failed without being required.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getAttentionChecks(checks: readonly MergeCheck[]): MergeCheck[] {
    const holding = checks.some(isHoldingCheck);
    const shown = checks.filter(check => check.state === 'failing' || (holding && check.state === 'pending'));
    return shown.toSorted((a, b) => Number(b.isRequired) - Number(a.isRequired) || compareChecks(a, b));
}
