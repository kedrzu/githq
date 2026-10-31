import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { shallowRef, watch } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import { MY_WORK_GROUPS } from '@/store/ItemStoreTypes.js';

import { SyncLeadership } from './SyncLeadership.js';
import { TabChannel } from './TabChannel.js';

/** Ids per `ItemDetails` call: GitHub's limit for it, at 3 points a call (measured with a dry run). */
const BATCH_SIZE = 10;
/** The pause between two batches, leaving GitHub — and the sync loops — room between them. */
const BATCH_GAP_MS = 2_000;
/** Below this many GraphQL points left, the allowance is kept for what the user does and the sync loops. */
const GRAPHQL_FLOOR = 500;
/** How long to wait after a batch failed as a whole, so one that keeps failing does not keep costing. */
const FAILURE_PAUSE_MS = 5 * 60_000;

/**
 * Reads ahead the details of the items in "my work" (D18), so opening one of them never waits for its comments.
 *
 * After each successful "my work" poll it takes the items whose detail is missing or behind the item's
 * `updatedAt`, group by group in the list's order, and reads them in batches of 10, one batch at a time with a
 * pause between them. Only the tab that syncs ({@link SyncLeadership}) reads ahead — the others get the details
 * it read through the detail store. It holds off while every tab of the account is hidden (going on when one is
 * shown again), while offline, and while fewer than 500 GraphQL points are left — the next poll after the
 * allowance resets goes on. An item GitHub would not give is not asked for again until it changes.
 *
 * It follows the signed-in user through the stores it reads: a batch started for one who signed out is dropped
 * by the detail store, and the next batch is not started.
 */
export type DetailPrefetch = Resolved<typeof DetailPrefetch>;
export const DetailPrefetch = defineService({
    name: 'DetailPrefetch',
    deps: {
        accounts: AccountSession,
        items: ItemStore,
        details: ItemDetailStore,
        rateLimits: GitHubRateLimitStore,
        leadership: SyncLeadership,
        tabs: TabChannel,
        browser: Browser,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, items, details, rateLimits, leadership, tabs, browser, clock, logger }) {
        const runningRef = shallowRef(false);
        let cancelNext: (() => void) | null = null;
        let pausedUntil = 0;
        /** Items GitHub would not give, with the `updatedAt` they had then. */
        const unreadable = new Map<string, string>();

        // Synchronous, to tell a poll from the kept copy being read: that one lands before `loaded` turns on.
        watch(
            () => items.getSyncState('myWork').lastSuccessAt,
            () => {
                if (items.loaded) {
                    schedule(0);
                }
            },
            { flush: 'sync' },
        );

        accounts.onChange(reset);

        // Shown again, or taking over from the tab that read ahead until now: it goes on.
        watch(
            () => tabs.anyVisible && leadership.isLeader,
            go => {
                if (go) {
                    schedule(0);
                }
            },
        );

        return {
            /** A batch is being read; reactive. */
            get running() {
                return runningRef.value;
            },
        };

        /** Runs the next batch after `delayMs`, unless one is running or already set. */
        function schedule(delayMs: number) {
            if (runningRef.value || cancelNext) {
                return;
            }

            cancelNext = clock.schedule(() => {
                cancelNext = null;
                void runBatch();
            }, delayMs);
        }

        async function runBatch() {
            const account = accounts.current;
            if (!account || !items.loaded || !mayPrefetch()) {
                return;
            }

            runningRef.value = true;
            try {
                await details.ready();
                const batch = accounts.isCurrent(account) ? findWanted().slice(0, BATCH_SIZE) : [];
                if (batch.length === 0) {
                    return;
                }

                const notGiven = await details.fetchDetails(batch);
                for (const id of notGiven) {
                    unreadable.set(id, items.get(id)?.updatedAt ?? '');
                }

                logger.debug('Item details prefetched', { count: batch.length, notGiven: notGiven.length });
            } catch (error) {
                pausedUntil = clock.now() + FAILURE_PAUSE_MS;
                logger.warn('Item details could not be prefetched; trying again later', { error });
                return;
            } finally {
                runningRef.value = false;
            }

            if (accounts.isCurrent(account)) {
                schedule(BATCH_GAP_MS);
            }
        }

        function mayPrefetch() {
            const remaining = rateLimits.remaining('graphql');
            return (
                leadership.isLeader &&
                tabs.anyVisible &&
                browser.isOnline() &&
                clock.now() >= pausedUntil &&
                (remaining === null || remaining >= GRAPHQL_FLOOR)
            );
        }

        /** The items of "my work" whose detail should be read, in the list's order. */
        function findWanted() {
            const wanted = new Set<string>();
            for (const group of MY_WORK_GROUPS) {
                for (const id of items.membership[group] ?? []) {
                    if (unreadable.has(id) && unreadable.get(id) === items.get(id)?.updatedAt) {
                        continue;
                    }

                    if (details.needsFetch(id)) {
                        wanted.add(id);
                    }
                }
            }

            return [...wanted];
        }

        /** Another user — or none — signed in: nothing of the one before carries over. */
        function reset() {
            cancelNext?.();
            cancelNext = null;
            pausedUntil = 0;
            unreadable.clear();
        }
    },
});
