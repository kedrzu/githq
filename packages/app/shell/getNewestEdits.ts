import type { SegmentEdits } from './SegmentEdits.js';

/** What a status bar segment could say of the user's edits, with when it happened. */
export interface DatedSegmentEdits {
    readonly edits: SegmentEdits;
    /** Epoch ms it happened. */
    readonly at: number;
}

/**
 * The newest of what a status bar segment could say of the user's edits — a failure, or a merge GitHub has not said
 * the end of (merging PM36) — so an older one never hides a later one; the first given on a tie. `null` for none.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getNewestEdits(candidates: readonly (DatedSegmentEdits | null)[]): SegmentEdits | null {
    let newest: DatedSegmentEdits | null = null;
    for (const candidate of candidates) {
        if (candidate && (newest === null || candidate.at > newest.at)) {
            newest = candidate;
        }
    }

    return newest?.edits ?? null;
}
