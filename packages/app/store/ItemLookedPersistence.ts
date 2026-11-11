import { defineInterface } from '@nzyme/ioc/Interface.js';

/** When the user last looked at an item on this device. */
export interface ItemLooked {
    /** The item's id. */
    readonly id: string;
    /** The newest item of its thread they saw (epoch ms, GitHub's time): what came after it is new to them. */
    readonly seenUntil: number;
    /** When they left it (epoch ms, this device's clock): what was not looked at for long is dropped. */
    readonly lookedAt: number;
}

/**
 * Where the times the user last looked at items are kept: in the copy of the login that `ItemPersistence.load`
 * opened (D17), deleted with it. Every method rejects when that copy is not open (anymore).
 */
export interface ItemLookedPersistenceShape {
    /** When the user last looked at `id`, or `null` when never on this device. */
    loadLooked(login: string, id: string): Promise<ItemLooked | null>;
    /** Adds it or replaces the one of its item. */
    saveLooked(login: string, looked: ItemLooked): Promise<void>;
    /** Drops every item last looked at before `before` (epoch ms). */
    deleteLookedBefore(login: string, before: number): Promise<void>;
}

/** Where the times are kept; the app sets IndexedDB (`createIndexedDbPersistence`). */
export const ItemLookedPersistence = defineInterface<ItemLookedPersistenceShape>({
    name: 'ItemLookedPersistence',
});
