import type { StackMerge } from './StackMergeTypes.js';

/**
 * The line of a stack's merge moved by one open pull request (`↑`: `earlier`, `↓`: `later`; stacked PRs D18): never
 * before the first open one nor past the last, and never onto a merged or closed one — the range cannot skip (D11).
 * The pull request's number; `null` when nothing is open.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function moveStackMergeEnd(merge: StackMerge, direction: 'earlier' | 'later'): number | null {
    const index = merge.going.length - 1 + (direction === 'earlier' ? -1 : 1);
    const clamped = Math.min(Math.max(index, 0), merge.open.length - 1);
    return merge.open[clamped]?.number ?? null;
}
