import type { TrackedStatus, TrackedSyncState, TrackingProgress } from '../TrackingTypes.js';

import { haveOpenItemsArrived } from './haveOpenItemsArrived.js';

/**
 * How a tracked repository or project stands, as Settings says it (`TrackedRowNote.vue`): not shown to the user,
 * downloading until its open items arrived, its changes refused (a repository's), else when it was last read.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getTrackedStatus(progress: TrackingProgress, state: TrackedSyncState | undefined): TrackedStatus {
    if (progress.state === 'hidden') {
        return { kind: 'hidden' };
    }

    if (!haveOpenItemsArrived(state)) {
        return { kind: 'downloading', done: progress.done, total: progress.total };
    }

    if (state.refused && state.kind === 'repository') {
        return { kind: 'refused' };
    }

    return { kind: 'read', at: state.lastSuccessAt, slower: state.refused !== null };
}
