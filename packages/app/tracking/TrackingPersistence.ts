import { defineInterface } from '@nzyme/ioc/Interface.js';

import type { TrackedSyncState, Tracking } from './TrackingTypes.js';

/** What one user tracks and how far each copy is, as kept on disk. */
export interface PersistedTracking {
    /** `null` until the user first chose. */
    readonly tracking: Tracking | null;
    readonly syncStates: readonly TrackedSyncState[];
}

/**
 * Where the tracking choice and the tracked copies' sync state are kept between sessions: in the copy of the
 * login that `ItemPersistence.load` opened (D17), deleted with it. Every method rejects when that copy is not
 * open (anymore) — a late write of a signed-out user must not bring their copy back.
 */
export interface TrackingPersistenceShape {
    loadTracking(login: string): Promise<PersistedTracking>;
    saveTracking(login: string, tracking: Tracking): Promise<void>;
    /** Adds the state or replaces it (by repository or project). */
    saveSyncState(login: string, state: TrackedSyncState): Promise<void>;
    deleteSyncState(login: string, state: TrackedSyncState): Promise<void>;
}

/** Where the tracking choice is kept; the app sets IndexedDB (`createIndexedDbPersistence`). */
export const TrackingPersistence = defineInterface<TrackingPersistenceShape>({
    name: 'TrackingPersistence',
});
