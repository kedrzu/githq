import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { Clock } from '@/services/Clock.js';

import { KEEP_DETAIL_MS } from './ItemDetailStore.js';
import { ItemLookedPersistence } from './ItemLookedPersistence.js';
import type { ItemLooked } from './ItemLookedPersistence.js';
import { ItemStore } from './ItemStore.js';

/** When the signed-in user last looked at items, on this device (item-activity F5, "New since you looked"). */
export interface ItemLookedStoreShape {
    /**
     * The newest item of `id`'s thread the user saw when they last left it (epoch ms); `null` when they never looked
     * at it on this device, when it could not be read, or when another account signed in meanwhile.
     */
    read(id: string): Promise<number | null>;
    /** The user leaves `id` having seen its thread up to `seenUntil` (epoch ms). Ignored while signed out. */
    mark(id: string, seenUntil: number): void;
}

/** The signed-in user the times are kept for, captured when they signed in. */
interface Session {
    readonly account: Account;
    /** Resolves once their local copy is open and the old times dropped; never rejects. */
    readonly ready: Promise<void>;
}

/**
 * When the signed-in user last looked at each item, kept in their local copy (a rebuildable cache: on a new device
 * nothing is marked) and gone with it when they sign out — one account's never marks another's items. Read from the
 * copy each time, so another tab's looking counts too; an item not looked at for as long as a detail is kept is
 * dropped when the user signs in.
 */
export const ItemLookedStore = defineService({
    name: 'ItemLookedStore',
    deps: {
        accounts: AccountSession,
        items: ItemStore,
        persistence: ItemLookedPersistence,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, items, persistence, clock, logger }): ItemLookedStoreShape {
        let session: Session | null = null;

        accounts.onChange(follow);

        return { read, mark };

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

            void save(current, { id, seenUntil, lookedAt: clock.now() });
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
            session = account ? { account, ready: dropOld(account) } : null;
        }

        /** Once the account's copy is open (`ItemStore`), the items not looked at for long are dropped. */
        async function dropOld(account: Account) {
            await items.ready();
            if (!accounts.isCurrent(account)) {
                return;
            }

            try {
                await persistence.deleteLookedBefore(account.login, clock.now() - KEEP_DETAIL_MS);
            } catch (error) {
                logger.warn('Could not drop the items not looked at for long', { error });
            }
        }

        /** Whether `current` is still the session — here and in the store every request was authorised by. */
        function isCurrent(current: Session) {
            return session === current && accounts.isCurrent(current.account);
        }
    },
});
