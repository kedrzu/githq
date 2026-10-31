import { defineInterface } from '@nzyme/ioc/Interface.js';

import type { ItemDetail } from './ItemDetailTypes.js';

/** What a kept detail was read with — enough to tell whether it is behind, without reading it. */
export interface ItemDetailVersion {
    /** The item's `updatedAt` when the detail was read. */
    readonly itemUpdatedAt: string;
    /** When it was read (epoch ms). */
    readonly fetchedAt: number;
}

/**
 * Where the details of items are kept between sessions: in the copy of the login that `ItemPersistence.load`
 * opened (D17), deleted with it. Every method rejects when that copy is not open (anymore) — a late answer of
 * a signed-out user must not bring their copy back.
 */
export interface ItemDetailPersistenceShape {
    /** The version of every kept detail, by item id — read at the start, while the details stay on disk (D17). */
    loadDetailVersions(login: string): Promise<ReadonlyMap<string, ItemDetailVersion>>;
    /** The kept detail of `id`, or `null`. */
    loadDetail(login: string, id: string): Promise<ItemDetail | null>;
    /** Adds the details or replaces them (by id). */
    saveDetails(login: string, details: readonly ItemDetail[]): Promise<void>;
    deleteDetails(login: string, ids: readonly string[]): Promise<void>;
}

/** Where the details are kept; the app sets IndexedDB (`createIndexedDbPersistence`). */
export const ItemDetailPersistence = defineInterface<ItemDetailPersistenceShape>({
    name: 'ItemDetailPersistence',
});
