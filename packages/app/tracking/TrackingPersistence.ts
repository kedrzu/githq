import { defineInterface } from '@nzyme/ioc/Interface.js';

import type { TrackedSyncState, Tracking } from './TrackingTypes.js';

/** How far each tracked copy is, as kept on disk, and the choice an older githq kept beside it. */
export interface PersistedTracking {
    /**
     * The choice as githq kept it here before it moved to `localStorage` (settings-sync D8): read only to take it
     * over, never written again. `null` when none was kept.
     */
    readonly tracking: Tracking | null;
    readonly syncStates: readonly TrackedSyncState[];
}

/**
 * Where the tracked copies' sync state is kept between sessions: in the copy of the
 * login that `ItemPersistence.load` opened (D17), deleted with it. Every method rejects when that copy is not
 * open (anymore) — a late write of a signed-out user must not bring their copy back.
 */
export interface TrackingPersistenceShape {
    loadTracking(login: string): Promise<PersistedTracking>;
    /** Adds the state or replaces it (by repository or project). */
    saveSyncState(login: string, state: TrackedSyncState): Promise<void>;
    deleteSyncState(login: string, state: TrackedSyncState): Promise<void>;
}

/** Where the tracked copies' sync state is kept; the app sets IndexedDB (`createIndexedDbPersistence`). */
export const TrackingPersistence = defineInterface<TrackingPersistenceShape>({
    name: 'TrackingPersistence',
});
