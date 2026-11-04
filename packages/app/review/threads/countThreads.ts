import type { ThreadPlacement } from './placeThreads.js';

/** What a file's header says of its threads (CR2, CR10, CR14): unresolved ones either `open`, `outdated` or `lineGone`; on a gone file all are `open`. */
export interface ThreadCounts {
    readonly open: number;
    /** Those placed by finding their line again. */
    readonly outdated: number;
    /** Outdated with their line not found: at the file's top with their old code. */
    readonly lineGone: number;
    readonly resolved: number;
}

/** @__NO_SIDE_EFFECTS__ */
export function countThreads(placements: readonly ThreadPlacement[]): ThreadCounts {
    let open = 0;
    let outdated = 0;
    let lineGone = 0;
    let resolved = 0;
    for (const { kind, thread } of placements) {
        if (thread.isResolved) {
            resolved++;
        } else if (!thread.isOutdated || kind === 'gone') {
            open++;
        } else if (kind === 'fileTop') {
            lineGone++;
        } else {
            outdated++;
        }
    }

    return { open, outdated, lineGone, resolved };
}
