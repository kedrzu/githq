import type { Item } from '@/store/ItemTypes.js';
import type { RepositoryDownloadPhase, RepositorySyncState } from '@/tracking/TrackingTypes.js';
import { REPOSITORY_DOWNLOAD_PHASES } from '@/tracking/TrackingTypes.js';

import type { RepositoryState } from './buildRepositoryList.js';

/**
 * Whether a tracked repository's first download has yet to read what a section lists in a state: its open issues or
 * pull requests for Open; for Closed, or both, its closed ones too, as they come last (G6). `sync` is its sync state,
 * `undefined` before its download started. Never once GitHub hides it: nothing more comes then (first run and loading
 * D5).
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isRepositoryStateArriving(
    sync: RepositorySyncState | undefined,
    kind: Item['kind'],
    state: RepositoryState,
): boolean {
    if (!sync) {
        return true;
    }

    if (sync.hidden || sync.phase === 'done') {
        return false;
    }

    return (
        REPOSITORY_DOWNLOAD_PHASES.indexOf(sync.phase) <= REPOSITORY_DOWNLOAD_PHASES.indexOf(getLastPhase(kind, state))
    );
}

/** The phase that reads the last of what the section lists in the state. */
function getLastPhase(kind: Item['kind'], state: RepositoryState): RepositoryDownloadPhase {
    if (state === 'open') {
        return kind === 'issue' ? 'openIssues' : 'openPullRequests';
    }

    return kind === 'issue' ? 'closedIssues' : 'closedPullRequests';
}
