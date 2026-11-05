import { defineInterface } from '@nzyme/ioc/Interface.js';

import type { TrackedSyncState } from './TrackingTypes.js';

/**
 * Where the tracked copies' sync state is kept between sessions: in the copy of the
 * login that `ItemPersistence.load` opened (D17), deleted with it. Every method rejects when that copy is not
 * open (anymore) — a late write of a signed-out user must not bring their copy back.
 */
export interface TrackingPersistenceShape {
    loadSyncStates(login: string): Promise<readonly TrackedSyncState[]>;
    /** Adds the state or replaces it (by repository or project). */
    saveSyncState(login: string, state: TrackedSyncState): Promise<void>;
    deleteSyncState(login: string, state: TrackedSyncState): Promise<void>;
}

/** Where the tracked copies' sync state is kept; the app sets IndexedDB (`createIndexedDbPersistence`). */
export const TrackingPersistence = defineInterface<TrackingPersistenceShape>({
    name: 'TrackingPersistence',
});
