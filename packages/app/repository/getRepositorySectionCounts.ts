import type { Item } from '@/store/ItemTypes.js';
import type { RepositorySyncState } from '@/tracking/TrackingTypes.js';
import type { RepositoryWorkflowList } from '@/workflows/buildRepositoryWorkflows.js';

import { isRepositoryStateArriving } from './isRepositoryStateArriving.js';

/** What a tracked repository's sections count, as its tabs and its rows in the sidebar show it; Commits counts nothing. */
export interface RepositorySectionCounts {
    /** Its open issues; `null` — no count — while its download has yet to read them, or GitHub hides it with none held. */
    readonly issues: number | null;
    /** Its open pull requests, as {@link RepositorySectionCounts.issues}. */
    readonly pullRequests: number | null;
    /** Its broken workflows: `unknown` (a dash) until known, `null` with no workflows or with alerts off. */
    readonly workflows: number | 'unknown' | null;
}

/** What {@link getRepositorySectionCounts} counts from. */
export interface GetRepositorySectionCountsParams {
    /** The repository's items in the local copy. */
    readonly items: readonly Item[];
    /** Its sync state; `undefined` before its download started. */
    readonly sync: RepositorySyncState | undefined;
    /** Its Workflows section, which counts its broken workflows itself (`buildRepositoryWorkflows`). */
    readonly workflows: RepositoryWorkflowList;
}

/**
 * How many open items Issues and Pull requests hold, and how many broken workflows Workflows does — the same on the
 * repository's tabs and under its row in the sidebar. A count is left out while its download has yet to read them, as
 * a partial total would read as the whole, and with none held of a repository GitHub hides, as nothing would read as
 * nothing there (first run and loading D4, D6, D14).
 * @__NO_SIDE_EFFECTS__
 */
export function getRepositorySectionCounts(params: GetRepositorySectionCountsParams): RepositorySectionCounts {
    const { items, sync, workflows } = params;
    const open = items.filter(item => item.state === 'OPEN');
    return { issues: countOf('issue'), pullRequests: countOf('pullRequest'), workflows: workflows.count };

    function countOf(kind: Item['kind']) {
        const count = open.filter(item => item.kind === kind).length;
        return isRepositoryStateArriving(sync, kind, 'open') || (sync?.hidden && count === 0) ? null : count;
    }
}
