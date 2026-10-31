import { defineInterface } from '@nzyme/ioc/Interface.js';

import type { MyWorkGroup, SyncLoop, SyncLoopState } from './ItemStoreTypes.js';
import type { Item } from './ItemTypes.js';

/** The local copy of one user, as kept on disk. */
export interface PersistedItems {
    readonly items: readonly Item[];
    /** Only the groups ever set. */
    readonly membership: Partial<Record<MyWorkGroup, readonly string[]>>;
    /** Only the loops ever run. */
    readonly sync: Partial<Record<SyncLoop, SyncLoopState>>;
}

/** What changed in memory since the last write. */
export interface ItemChanges {
    readonly upserted: readonly Item[];
    readonly removed: readonly string[];
    /** Every group's ids, replacing the kept ones; `null` when unchanged. */
    readonly membership: Partial<Record<MyWorkGroup, readonly string[]>> | null;
    /** Every loop's state, replacing the kept ones; `null` when unchanged. */
    readonly sync: Partial<Record<SyncLoop, SyncLoopState>> | null;
}

/**
 * Where the local copy is kept between sessions, one per GitHub login so one account never reads another's
 * (D17). A cache: losing it costs a sync, never data.
 */
export interface ItemPersistenceShape {
    /** Opens `login`'s copy — creating it, or rebuilding one of another schema — and reads all of it. */
    load(login: string): Promise<PersistedItems>;
    /** Writes `changes` to the copy {@link load} opened; rejects when it is not open (anymore). */
    save(login: string, changes: ItemChanges): Promise<void>;
    /** Deletes `login`'s copy. */
    destroy(login: string): Promise<void>;
}

/** Where the local copy is kept; the app sets IndexedDB (`createIndexedDbPersistence`). */
export const ItemPersistence = defineInterface<ItemPersistenceShape>({
    name: 'ItemPersistence',
});
