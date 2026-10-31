import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { computed, shallowRef, triggerRef, watch } from 'vue';

import { AuthStore } from '@/auth/AuthStore.js';
import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import { TabChannel } from '@/sync/TabChannel.js';
import { createTabInbox } from '@/sync/createTabInbox.js';
import type { TabInbox } from '@/sync/createTabInbox.js';
import type { TabMessage } from '@/sync/TabChannel.js';

import { ItemOverlay } from './ItemOverlay.js';
import type { ItemChanges, PersistedItems } from './ItemPersistence.js';
import { ItemPersistence } from './ItemPersistence.js';
import { isOlderCopy } from './isOlderCopy.js';
import { MY_WORK_GROUPS, SYNC_LOOPS } from './ItemStoreTypes.js';
import type { MyWorkGroup, MyWorkMembership, SyncLoop, SyncLoopState } from './ItemStoreTypes.js';
import type { Item } from './ItemTypes.js';

/** How long changes gather in memory before they are written in one go. */
const WRITE_DELAY_MS = 200;

const NEVER_RUN: SyncLoopState = { lastAttemptAt: null, lastSuccessAt: null, lastError: null, incomplete: false };

/** The local copy of the signed-in user, while they are signed in. */
interface Session {
    readonly login: string;
    /** Items changed in memory since the last write: written when in memory, deleted when not. */
    readonly dirtyIds: Set<string>;
    membershipDirty: boolean;
    syncDirty: boolean;
    timer: ReturnType<typeof setTimeout> | null;
    /** The write on its way, until it is done. */
    writing: ItemChanges | null;
    /** What other tabs send: held until the kept copy is read, then taken in over it. */
    readonly inbox: TabInbox;
}

/**
 * The local working set of the signed-in user (D17): issues and pull requests by id, which of them are in
 * "my work" and why, and how each sync loop last went. Every screen reads it from memory; sync writes into it.
 *
 * Memory is the truth for the session. IndexedDB (`githq-<login>`) only lets a reload start from the last state:
 * it is read when a user is signed in — before any list renders ({@link ready}) — and written behind, in batches.
 * A failed write is logged and tried again with the next change; it never reaches the caller or memory.
 *
 * A user's copy is opened only while they are signed in, and deleted when they sign out — here, by a token GitHub
 * rejects, or in another tab.
 *
 * Every change is sent to the user's other tabs ({@link TabChannel}), which take it into memory only: the tab that
 * made it writes it. A copy of an item older than the one held ({@link isOlderCopy}) — a sync answer read before
 * an edit GitHub confirmed meanwhile — is not taken, here or from another tab.
 *
 * A tab opening reads the copy while the changes of the last moment may not be in it yet: each tab sends it what
 * it has not written yet, and writes it at once when it is closed.
 */
export type ItemStore = Resolved<typeof ItemStore>;
export const ItemStore = defineService({
    name: 'ItemStore',
    deps: {
        auth: AuthStore,
        persistence: ItemPersistence,
        overlay: ItemOverlay,
        tabs: TabChannel,
        browser: Browser,
        clock: Clock,
        logger: Logger,
    },
    setup({ auth, persistence, overlay, tabs, browser, clock, logger }) {
        const itemsRef = shallowRef(new Map<string, Item>());
        const membershipRef = shallowRef<MyWorkMembership>({});
        const syncRef = shallowRef<Partial<Record<SyncLoop, SyncLoopState>>>({});
        const loadedRef = shallowRef(false);

        // The issues being created show with the rest until the copy holds them (and, in "my work", for a while
        // after: GitHub's search finds a new issue later than the store does).
        const added = computed(() => overlay.getAddedItems());
        const all = computed(() => {
            const shown = [...itemsRef.value.values()].map(item => overlay.applyToItem(item));
            for (const { item } of added.value) {
                if (!itemsRef.value.has(item.id)) {
                    shown.push(item);
                }
            }

            return shown;
        });
        const membership = computed((): MyWorkMembership => {
            const stored = membershipRef.value;
            const extended: Partial<Record<MyWorkGroup, Set<string>>> = {};
            for (const { item, myWorkGroup } of added.value) {
                const ids = myWorkGroup && stored[myWorkGroup];
                if (myWorkGroup && ids && !ids.has(item.id)) {
                    (extended[myWorkGroup] ??= new Set(ids)).add(item.id);
                }
            }

            return Object.keys(extended).length > 0 ? { ...stored, ...extended } : stored;
        });

        let session: Session | null = null;
        let loading = Promise.resolve();

        watch(() => auth.viewer?.login ?? null, followLogin, { immediate: true, flush: 'sync' });
        tabs.onMessage(receive);
        tabs.onTabJoined(publishUnwritten);
        browser.onPageLifecycle(event => {
            if (event === 'pagehide') {
                void flush();
            }
        });

        return {
            /** Whether the signed-in user's kept copy is in memory; reactive. */
            get loaded() {
                return loadedRef.value;
            },
            ready,
            /** Every item, with the user's changes on their way drawn over it ({@link ItemOverlay}); reactive. */
            get all(): readonly Item[] {
                return all.value;
            },
            /** The item ids of each "my work" group that has arrived, with the issues being created; reactive. */
            get membership() {
                return membership.value;
            },
            get,
            getStored,
            getSyncState,
            upsertMany,
            remove,
            setMembership,
            setSyncState,
            flush,
        };

        /**
         * The item with the user's changes on their way drawn over it ({@link ItemOverlay}) — an issue being created
         * too — or `undefined`; reactive.
         */
        function get(id: string) {
            const item = itemsRef.value.get(id);
            if (item) {
                return overlay.applyToItem(item);
            }

            return added.value.find(entry => entry.item.id === id)?.item;
        }

        /**
         * The item as GitHub last gave it, without the user's changes on their way — what a write that patches a
         * stored item starts from, so that a change GitHub may still refuse never becomes part of it.
         */
        function getStored(id: string) {
            return itemsRef.value.get(id);
        }

        /** How `loop` last went; reactive. */
        function getSyncState(loop: SyncLoop) {
            return syncRef.value[loop] ?? NEVER_RUN;
        }

        /**
         * Adds the items or replaces them (by id), except over a newer copy ({@link isOlderCopy}). Ignored while
         * signed out.
         */
        function upsertMany(items: Iterable<Item>) {
            const current = session;
            if (!current) {
                return;
            }

            const upserted = [...items].filter(item => !isOlder(item));
            if (upserted.length === 0) {
                return;
            }

            for (const item of upserted) {
                itemsRef.value.set(item.id, item);
                current.dirtyIds.add(item.id);
            }

            triggerRef(itemsRef);
            scheduleWrite(current);
            tabs.publish({ kind: 'items', upserted, removed: [] });
        }

        /** Removes the items. Ignored while signed out. */
        function remove(ids: Iterable<string>) {
            const current = session;
            if (!current) {
                return;
            }

            const removed = [...ids];
            if (removed.length === 0) {
                return;
            }

            for (const id of removed) {
                itemsRef.value.delete(id);
                current.dirtyIds.add(id);
            }

            triggerRef(itemsRef);
            scheduleWrite(current);
            tabs.publish({ kind: 'items', upserted: [], removed });
        }

        /** Replaces the item ids of a "my work" group. Ignored while signed out. */
        function setMembership(group: MyWorkGroup, ids: Iterable<string>) {
            const current = session;
            if (!current) {
                return;
            }

            const members = [...ids];
            membershipRef.value = { ...membershipRef.value, [group]: new Set(members) };
            current.membershipDirty = true;
            scheduleWrite(current);
            tabs.publish({ kind: 'membership', group, ids: members });
        }

        /** Records how `loop` went. Ignored while signed out. */
        function setSyncState(loop: SyncLoop, state: SyncLoopState) {
            const current = session;
            if (!current) {
                return;
            }

            syncRef.value = { ...syncRef.value, [loop]: state };
            current.syncDirty = true;
            scheduleWrite(current);
            tabs.publish({ kind: 'syncState', loop, state });
        }

        /** Takes in what another tab of the user changed — in memory only: that tab writes it. */
        function receive(message: TabMessage, login: string) {
            const current = session;
            if (current?.login !== login) {
                return;
            }

            current.inbox.deliver(message);
        }

        function takeIn(message: TabMessage) {
            switch (message.kind) {
                case 'items': {
                    for (const item of message.upserted) {
                        if (!isOlder(item)) {
                            itemsRef.value.set(item.id, item);
                        }
                    }

                    for (const id of message.removed) {
                        itemsRef.value.delete(id);
                    }

                    triggerRef(itemsRef);
                    break;
                }
                case 'membership':
                    membershipRef.value = { ...membershipRef.value, [message.group]: new Set(message.ids) };
                    break;
                case 'syncState':
                    syncRef.value = { ...syncRef.value, [message.loop]: message.state };
                    break;
                default:
                    break;
            }
        }

        function isOlder(item: Item) {
            const held = itemsRef.value.get(item.id);
            return held !== undefined && isOlderCopy(item, held, clock.now());
        }

        /** Writes the changes gathered so far now, instead of after the delay; never rejects. */
        async function flush() {
            const current = session;
            if (!current) {
                return;
            }

            if (current.timer !== null) {
                clearTimeout(current.timer);
                current.timer = null;
            }

            // Nothing is written over the kept copy before it has been read.
            await loading;
            if (session !== current) {
                return;
            }

            const changes = takeChanges(current);
            if (!changes) {
                return;
            }

            current.writing = changes;
            try {
                await persistence.save(current.login, changes);
            } catch (error) {
                logger.warn('Could not write the local copy; it is tried again with the next change', { error });
                markUnwritten(current, changes);
            } finally {
                if (current.writing === changes) {
                    current.writing = null;
                }
            }
        }

        /**
         * Sends a tab that just opened what this one changed and has not written yet: reading the copy, it does not
         * find it there, and the messages that carried it were sent before it listened.
         */
        function publishUnwritten() {
            const current = session;
            if (!current || !loadedRef.value) {
                return;
            }

            const { writing } = current;
            const ids = new Set([
                ...current.dirtyIds,
                ...(writing?.upserted.map(item => item.id) ?? []),
                ...(writing?.removed ?? []),
            ]);
            const upserted: Item[] = [];
            const removed: string[] = [];
            for (const id of ids) {
                const item = itemsRef.value.get(id);
                if (item) {
                    upserted.push(item);
                } else {
                    removed.push(id);
                }
            }

            if (ids.size > 0) {
                tabs.publish({ kind: 'items', upserted, removed });
            }

            if (current.membershipDirty || writing?.membership) {
                for (const group of MY_WORK_GROUPS) {
                    const members = membershipRef.value[group];
                    if (members) {
                        tabs.publish({ kind: 'membership', group, ids: [...members] });
                    }
                }
            }

            if (current.syncDirty || writing?.sync) {
                for (const loop of SYNC_LOOPS) {
                    const state = syncRef.value[loop];
                    if (state) {
                        tabs.publish({ kind: 'syncState', loop, state });
                    }
                }
            }
        }

        /**
         * Resolves once the signed-in user's kept copy is in memory (at once when signed out); never rejects. It
         * looks a moment later, so a store following the same sign-in from a watcher that ran before this one's
         * waits for the copy of the user who just signed in.
         */
        async function ready() {
            await Promise.resolve();
            await loading;
        }

        /**
         * The signed-in user changed. The one before signed out (or another took over the tab): their copy leaves
         * memory and is deleted, with the writes still waiting. The new one's copy is read.
         */
        function followLogin(login: string | null) {
            const previous = session;
            if (previous?.login === login) {
                return;
            }

            if (previous) {
                if (previous.timer !== null) {
                    clearTimeout(previous.timer);
                }

                persistence.destroy(previous.login).catch((error: unknown) => {
                    logger.warn('Could not delete the local copy of a signed-out user', { error });
                });
            }

            itemsRef.value = new Map();
            membershipRef.value = {};
            syncRef.value = {};
            loadedRef.value = false;

            if (login === null) {
                session = null;
                loading = Promise.resolve();
                return;
            }

            const current: Session = {
                login,
                dirtyIds: new Set(),
                membershipDirty: false,
                syncDirty: false,
                timer: null,
                writing: null,
                inbox: createTabInbox(takeIn),
            };
            session = current;
            loading = load(current);
        }

        async function load(current: Session) {
            let persisted: PersistedItems | null = null;
            try {
                persisted = await persistence.load(current.login);
            } catch (error) {
                logger.warn('Could not read the local copy; starting from an empty one', { error });
            }

            if (session !== current) {
                return;
            }

            if (persisted) {
                restore(current, persisted);
            }

            loadedRef.value = true;
            current.inbox.open();
        }

        /** Puts the kept copy into memory under whatever this session already changed, which is newer. */
        function restore(current: Session, persisted: PersistedItems) {
            const items = itemsRef.value;
            for (const item of persisted.items) {
                if (!current.dirtyIds.has(item.id)) {
                    items.set(item.id, item);
                }
            }

            const groups: Partial<Record<MyWorkGroup, ReadonlySet<string>>> = {};
            for (const group of MY_WORK_GROUPS) {
                const ids = persisted.membership[group];
                if (ids) {
                    groups[group] = new Set(ids);
                }
            }

            triggerRef(itemsRef);
            membershipRef.value = { ...groups, ...membershipRef.value };
            syncRef.value = { ...persisted.sync, ...syncRef.value };
        }

        function scheduleWrite(current: Session) {
            current.timer ??= setTimeout(() => {
                current.timer = null;
                void flush();
            }, WRITE_DELAY_MS);
        }

        /** What changed since the last write, as it is in memory now; `null` when nothing did. */
        function takeChanges(current: Session): ItemChanges | null {
            if (current.dirtyIds.size === 0 && !current.membershipDirty && !current.syncDirty) {
                return null;
            }

            const upserted: Item[] = [];
            const removed: string[] = [];
            for (const id of current.dirtyIds) {
                const item = itemsRef.value.get(id);
                if (item) {
                    upserted.push(item);
                } else {
                    removed.push(id);
                }
            }

            let membershipChanges: Partial<Record<MyWorkGroup, readonly string[]>> | null = null;
            if (current.membershipDirty) {
                membershipChanges = {};
                for (const group of MY_WORK_GROUPS) {
                    const ids = membershipRef.value[group];
                    if (ids) {
                        membershipChanges[group] = [...ids];
                    }
                }
            }

            const changes: ItemChanges = {
                upserted,
                removed,
                membership: membershipChanges,
                sync: current.syncDirty ? syncRef.value : null,
            };

            current.dirtyIds.clear();
            current.membershipDirty = false;
            current.syncDirty = false;
            return changes;
        }

        /** A write failed: what it carried is written again with the next one, from memory as it is then. */
        function markUnwritten(current: Session, changes: ItemChanges) {
            for (const item of changes.upserted) {
                current.dirtyIds.add(item.id);
            }

            for (const id of changes.removed) {
                current.dirtyIds.add(id);
            }

            current.membershipDirty ||= changes.membership !== null;
            current.syncDirty ||= changes.sync !== null;
        }
    },
});
