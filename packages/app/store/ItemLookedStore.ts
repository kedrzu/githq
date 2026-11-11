import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';

import { ItemLookedPersistence } from './ItemLookedPersistence.js';
import type { ItemLooked } from './ItemLookedPersistence.js';
import { ItemStore } from './ItemStore.js';

/** When the signed-in user last looked at items, on this device (item-activity F5, "New since you looked"). */
export interface ItemLookedStoreShape {
    /**
     * The user opens `id`: when they last looked at it, and when they opened it. Held while it stays open — opened
     * again in another arrangement (panel, modal, page), it gets the same, though its thread was marked seen since —
     * until another item opens, it is left ({@link leave}) or another account signs in.
     */
    open(id: string): Promise<ItemOpening>;
    /** The user left `id` (closed it): opened again, it is read afresh. */
    leave(id: string): void;
    /** The user has seen `id`'s thread up to `seenUntil` (epoch ms). Ignored while signed out. */
    mark(id: string, seenUntil: number): void;
}

/** An item as the user opened it. */
export interface ItemOpening {
    /**
     * The newest item of its thread the user had seen before (epoch ms); `null` when they never looked at it on this
     * device, when it could not be read, or when another account signed in meanwhile.
     */
    readonly lookedAt: number | null;
    /** When it was opened (epoch ms, this device's clock). */
    readonly openedAt: number;
}

/** The item open now, as it was opened. */
interface Held {
    readonly id: string;
    readonly opening: Promise<ItemOpening>;
}

/** The signed-in user the times are kept for, captured when they signed in. */
interface Session {
    readonly account: Account;
    /** Resolves once their local copy is open; never rejects. */
    readonly ready: Promise<void>;
}

/**
 * When the signed-in user last looked at each item, kept in their local copy (a rebuildable cache: on a new device
 * nothing is marked) and gone with it when they sign out — one account's never marks another's items. Read from the
 * copy each time, so another tab's looking counts too. Never dropped while the copy stays: a time is a few bytes an
 * item, and the copy is rebuilt with every new layout (`LOCAL_DATABASE_VERSION`). The item open now is held in memory
 * as it was opened, for its thread is marked seen while it shows: the time read then is the one its line keeps.
 */
export const ItemLookedStore = defineService({
    name: 'ItemLookedStore',
    deps: {
        accounts: AccountSession,
        items: ItemStore,
        persistence: ItemLookedPersistence,
        logger: Logger,
    },
    setup({ accounts, items, persistence, logger }): ItemLookedStoreShape {
        let session: Session | null = null;
        let held: Held | null = null;

        accounts.onChange(follow);

        return { open, leave, mark };

        function open(id: string) {
            if (held?.id === id) {
                return held.opening;
            }

            const openedAt = Date.now();
            const opening = read(id).then((lookedAt): ItemOpening => ({ lookedAt, openedAt }));
            held = session ? { id, opening } : null;
            return opening;
        }

        function leave(id: string) {
            if (held?.id === id) {
                held = null;
            }
        }

        async function read(id: string) {
            const current = session;
            if (!current) {
                return null;
            }

            await current.ready;
            if (!isCurrent(current)) {
                return null;
            }

            try {
                const looked = await persistence.loadLooked(current.account.login, id);
                return isCurrent(current) ? (looked?.seenUntil ?? null) : null;
            } catch (error) {
                logger.warn('Could not read when an item was last looked at', { error });
                return null;
            }
        }

        function mark(id: string, seenUntil: number) {
            const current = session;
            if (!current) {
                return;
            }

            void save(current, { id, seenUntil });
        }

        async function save(current: Session, looked: ItemLooked) {
            await current.ready;
            if (!isCurrent(current)) {
                return;
            }

            try {
                await persistence.saveLooked(current.account.login, looked);
            } catch (error) {
                if (isCurrent(current)) {
                    logger.warn('Could not keep when an item was last looked at', { error });
                }
            }
        }

        /** Another account signed in, or none: what was kept for the one before is theirs alone, and goes with their copy. */
        function follow(account: Account | null) {
            session = account ? { account, ready: items.ready() } : null;
            held = null;
        }

        /** Whether `current` is still the session — here and in the store every request was authorised by. */
        function isCurrent(current: Session) {
            return session === current && accounts.isCurrent(current.account);
        }
    },
});
