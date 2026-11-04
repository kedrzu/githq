import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { computed, shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import { Clock } from '@/services/Clock.js';
import { TabChannel } from '@/sync/TabChannel.js';

/** Going back to a repository just left shows what was read, rather than reading it again. */
const HOLD_AFTER_LEAVING_MS = 600_000;

/** This tab's hold of one repository. */
interface Hold {
    /** As it was first held, for those told it was let go. */
    readonly name: string;
    /** The screens holding it now; none while it only lasts on. */
    holders: number;
    /** Cancels the end of a hold no screen has any more; `null` while one has. */
    stopLasting: (() => void) | null;
}

/**
 * Which repositories' rows the local copy keeps though nothing syncs them (D32): a screen browsing a repository holds
 * it while it is open, the hold lasts a while after it is released, and all of the account's tabs know of it, since
 * any of them may be the one cleaning up. A tab's holds end with the tab (`TabChannel` forgets it) and with the account.
 */
export type RepositoryHolds = Resolved<typeof RepositoryHolds>;
export const RepositoryHolds = defineService({
    name: 'RepositoryHolds',
    deps: {
        accounts: AccountSession,
        tabs: TabChannel,
        clock: Clock,
    },
    setup({ accounts, tabs, clock }) {
        const holds = new Map<string, Hold>();
        const ownRef = shallowRef<readonly string[]>([]);
        const letGoListeners: ((nameWithOwner: string) => void)[] = [];

        const held = computed(
            () => new Set([...ownRef.value, ...tabs.otherHeldRepositories].map(name => name.toLowerCase())),
        );

        accounts.onChange(endAll);

        return { hold, isHeld, onLetGo };

        /**
         * Holds the repository for a screen; returns its release. Each hold counts: the repository is let go only after
         * the last is released, and {@link HOLD_AFTER_LEAVING_MS} with none taken again.
         */
        function hold(nameWithOwner: string) {
            const key = nameWithOwner.toLowerCase();
            const entry = holds.get(key) ?? addEntry(key, nameWithOwner);
            entry.stopLasting?.();
            entry.stopLasting = null;
            entry.holders++;

            let released = false;
            return () => {
                if (released) {
                    return;
                }

                released = true;
                entry.holders--;
                // A hold of the account before this one is over already; the same name may be held anew since.
                if (entry.holders === 0 && holds.get(key) === entry) {
                    entry.stopLasting = clock.schedule(() => letGo(key, entry), HOLD_AFTER_LEAVING_MS);
                }
            };
        }

        /** Whether this tab or another of the account holds the repository, in any case of its name; reactive. */
        function isHeld(nameWithOwner: string) {
            return held.value.has(nameWithOwner.toLowerCase());
        }

        /**
         * Calls `listener` with the repository's name when this tab's hold of it has ended, its lasting over or its
         * account gone. Other tabs may still hold it.
         */
        function onLetGo(listener: (nameWithOwner: string) => void) {
            letGoListeners.push(listener);
        }

        function addEntry(key: string, name: string) {
            const entry: Hold = { name, holders: 0, stopLasting: null };
            holds.set(key, entry);
            announce();
            return entry;
        }

        function letGo(key: string, entry: Hold) {
            holds.delete(key);
            announce();
            tellLetGo(entry);
        }

        function endAll() {
            if (holds.size === 0) {
                return;
            }

            const ended = [...holds.values()];
            holds.clear();
            announce();
            for (const entry of ended) {
                entry.stopLasting?.();
                tellLetGo(entry);
            }
        }

        function announce() {
            ownRef.value = [...holds.values()].map(entry => entry.name);
            tabs.setHeldRepositories(ownRef.value);
        }

        function tellLetGo(entry: Hold) {
            for (const listener of letGoListeners) {
                listener(entry.name);
            }
        }
    },
});
