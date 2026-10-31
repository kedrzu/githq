import type { TrackedSyncState } from '../TrackingTypes.js';

/**
 * Whether a tracked repository's or project's open items have arrived — a repository's once its download moved
 * past the open issues and pull requests (G6), a project's once all its items were read — so its lists are whole
 * and it is fresh as its poll goes. `false` before its download started.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function haveOpenItemsArrived<T extends TrackedSyncState>(state: T | undefined): state is T {
    if (!state) {
        return false;
    }

    return state.kind === 'repository'
        ? state.phase !== 'openIssues' && state.phase !== 'openPullRequests'
        : state.downloaded;
}
