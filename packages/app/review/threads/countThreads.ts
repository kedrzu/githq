import type { ThreadPlacement } from './placeThreads.js';

/** What a file's header says of its threads (CR2): unresolved ones either `open` or `outdated`. */
export interface ThreadCounts {
    readonly open: number;
    readonly outdated: number;
    readonly resolved: number;
}

/** @__NO_SIDE_EFFECTS__ */
export function countThreads(placements: readonly ThreadPlacement[]): ThreadCounts {
    let open = 0;
    let outdated = 0;
    let resolved = 0;
    for (const { thread } of placements) {
        if (thread.isResolved) {
            resolved++;
        } else if (thread.isOutdated) {
            outdated++;
        } else {
            open++;
        }
    }

    return { open, outdated, resolved };
}
