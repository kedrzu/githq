import { formatBytes } from '@/utils/formatBytes.js';

import type { ReviewFileSizes } from '../ReviewFiles.js';

/**
 * A file's size as a review says it: `12 kB → 14 kB`, or the one side that has one. `null` with neither.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function formatFileSizes({ before, after }: ReviewFileSizes) {
    if (before !== null && after !== null) {
        return `${formatBytes(before)} → ${formatBytes(after)}`;
    }

    const size = before ?? after;
    return size === null ? null : formatBytes(size);
}
