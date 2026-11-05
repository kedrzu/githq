import type { ReviewRow, ReviewThreadRow } from '../buildReviewRows.js';

/**
 * The threads N and ⇧N walk, of what has rows: the unresolved ones in diff order, then the resolved ones (CR15).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function listWalkedThreads(rows: readonly ReviewRow[]): ReviewThreadRow[] {
    const threads = rows.filter(row => row.kind === 'thread');
    return [
        ...threads.filter(row => !row.placement.thread.isResolved),
        ...threads.filter(row => row.placement.thread.isResolved),
    ];
}

export interface FindThreadFromRowParams {
    readonly rows: readonly ReviewRow[];
    /** The row being read. */
    readonly key: string | null;
    /** N is 1, ⇧N is -1. */
    readonly delta: 1 | -1;
}

/**
 * Where N or ⇧N goes from a row being read rather than a thread at hand: the nearest open thread that way, or with none
 * the nearest resolved one, the row itself counting as above it. `null` when none lies that way.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findThreadFromRow({ rows, key, delta }: FindThreadFromRowParams): ReviewThreadRow | null {
    const at = rows.findIndex(row => row.key === key);
    const ahead = delta === 1 ? rows.slice(at + 1) : rows.slice(0, at + 1).toReversed();
    const threads = ahead.filter(row => row.kind === 'thread');
    return threads.find(row => !row.placement.thread.isResolved) ?? threads[0] ?? null;
}
