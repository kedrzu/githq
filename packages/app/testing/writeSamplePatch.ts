import { assert } from '@nzyme/utils/assert.js';

import type { FileDiff } from '../review/diff/computeFileDiff.js';

/** Unchanged lines a patch shows around a change, as git does by default. */
const PATCH_CONTEXT = 3;

/** A file's patch as `GET …/pulls/{n}/files` gives it, with its line counts. */
export interface SamplePatch {
    readonly additions: number;
    readonly deletions: number;
    /** Left out where nothing changed, as for a pure rename. */
    readonly patch?: string;
}

/**
 * The patch git would write of our own diff: blocks at most two contexts apart share a hunk, the context is clamped to
 * the file, and a side with no lines in a hunk starts at the line before (0 at the top). GitHub's own patch is git's
 * diff, which can pair or place a change differently from ours (D6).
 *
 * Imported by the e2e package, so only relative imports.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function writeSamplePatch(diff: FileDiff): SamplePatch {
    const hunks: string[] = [];
    let additions = 0;
    let deletions = 0;
    let index = 0;
    while (index < diff.blocks.length) {
        // Blocks closer than twice the context share a hunk.
        let last = index;
        while (
            last + 1 < diff.blocks.length &&
            (diff.blocks[last + 1]?.beforeStart ?? 0) - (diff.blocks[last]?.beforeEnd ?? 0) <= 2 * PATCH_CONTEXT
        ) {
            last++;
        }

        const first = diff.blocks[index];
        const end = diff.blocks[last];
        assert(first && end);
        const beforeStart = Math.max(0, first.beforeStart - PATCH_CONTEXT);
        const afterStart = Math.max(0, first.afterStart - PATCH_CONTEXT);
        const beforeEnd = Math.min(diff.before.length, end.beforeEnd + PATCH_CONTEXT);
        const afterEnd = Math.min(diff.after.length, end.afterEnd + PATCH_CONTEXT);
        const lines: string[] = [];
        let beforeLine = beforeStart;
        let afterLine = afterStart;
        for (const block of diff.blocks.slice(index, last + 1)) {
            for (; beforeLine < block.beforeStart; beforeLine++, afterLine++) {
                lines.push(` ${diff.before[beforeLine]}`);
            }

            for (; beforeLine < block.beforeEnd; beforeLine++) {
                lines.push(`-${diff.before[beforeLine]}`);
                deletions++;
            }

            for (; afterLine < block.afterEnd; afterLine++) {
                lines.push(`+${diff.after[afterLine]}`);
                additions++;
            }
        }

        for (; beforeLine < beforeEnd && afterLine < afterEnd; beforeLine++, afterLine++) {
            lines.push(` ${diff.before[beforeLine]}`);
        }

        const beforeCount = beforeEnd - beforeStart;
        const afterCount = afterEnd - afterStart;
        // An empty side starts at the line before it, 0 at the top.
        const header = `@@ -${beforeCount === 0 ? beforeStart : beforeStart + 1},${beforeCount} +${afterCount === 0 ? afterStart : afterStart + 1},${afterCount} @@`;
        hunks.push([header, ...lines].join('\n'));
        index = last + 1;
    }

    return hunks.length === 0 ? { additions, deletions } : { additions, deletions, patch: hunks.join('\n') };
}
