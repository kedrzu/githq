import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { computed, shallowRef, watch } from 'vue';

import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';

import { TrackingStore } from './TrackingStore.js';
import type { TrackedTarget } from './TrackingTypes.js';
import { getTrackedKey } from './utils/getTrackedKey.js';

/** How long Undo is offered (D25, T20). */
const UNDO_MS = 10_000;

/** A repository or project the user stopped tracking, with Undo still on offer. */
export interface PendingUntrack {
    readonly target: TrackedTarget;
    /** What the toast calls it: `owner/name`, a project's title. */
    readonly label: string;
}

/**
 * Untracking with Undo (D25, T20): the entry leaves what the app lists at once, and only when the time is up, the
 * toast is dismissed or the page hides does it become a plain `TrackingStore.untrack`. Until then the settings stay
 * as they were, so it is kept and synced as ever: anything not tracked is evicted by whichever tab leads sync, and
 * its sync state would keep a later re-track from downloading it again.
 *
 * An entry no longer tracked is forgotten, so nothing is committed for it — untracked elsewhere (another tab, a menu's
 * plain untrack), or another account or none signed in, which empties what the store tracks at that very moment.
 * A service, so it outlives the route: moving between screens keeps the toast and Undo.
 */
export type PendingUntracks = Resolved<typeof PendingUntracks>;
export const PendingUntracks = defineService({
    name: 'PendingUntracks',
    deps: {
        browser: Browser,
        clock: Clock,
        tracking: TrackingStore,
    },
    setup({ browser, clock, tracking }) {
        /** Oldest first. */
        const entriesRef = shallowRef<readonly PendingUntrack[]>([]);
        /** What cancels each entry's time, by its key. */
        const timers = new Map<string, () => void>();
        const keys = computed(() => new Set(entriesRef.value.map(entry => getTrackedKey(entry.target))));
        const repositories = computed(() =>
            tracking.repositories.filter(
                repository => !isPending({ kind: 'repository', nameWithOwner: repository.nameWithOwner }),
            ),
        );
        const projects = computed(() =>
            tracking.projects.filter(project => !isPending({ kind: 'project', id: project.id })),
        );

        watch([() => tracking.repositories, () => tracking.projects], forgetUntracked, { flush: 'sync' });
        browser.onPageLifecycle(event => {
            if (event === 'pagehide') {
                for (const entry of entriesRef.value) {
                    commit(entry.target);
                }
            }
        });

        return {
            /** The tracked repositories less the pending ones, in the user's order: what the app lists. Reactive. */
            get repositories() {
                return repositories.value;
            },
            /** The tracked projects less the pending ones, in the user's order: what the app lists. Reactive. */
            get projects() {
                return projects.value;
            },
            /** What the toast shows and ⌘Z undoes, `null` with nothing pending; reactive. */
            get latest(): PendingUntrack | null {
                return entriesRef.value.at(-1) ?? null;
            },
            isPending,
            untrack,
            undo,
            commit,
        };

        /** Whether the repository or project is on its way out, with Undo on offer; reactive. */
        function isPending(target: TrackedTarget) {
            return keys.value.has(getTrackedKey(target));
        }

        /** Starts the time for it; nothing when it is not tracked, or is pending already (it keeps its time). */
        function untrack(target: TrackedTarget, label: string) {
            if (!tracking.isTracked(target) || isPending(target)) {
                return;
            }

            timers.set(
                getTrackedKey(target),
                clock.schedule(() => commit(target), UNDO_MS),
            );
            entriesRef.value = [...entriesRef.value, { target, label }];
        }

        /** Takes it back: nothing was written, so nothing is downloaded again. */
        function undo(target: TrackedTarget) {
            forget(target);
        }

        /** Untracks it now; nothing when it is not pending. */
        function commit(target: TrackedTarget) {
            if (forget(target)) {
                tracking.untrack(target);
            }
        }

        function forgetUntracked() {
            for (const entry of entriesRef.value) {
                if (!tracking.isTracked(entry.target)) {
                    forget(entry.target);
                }
            }
        }

        /** Returns whether it was pending. */
        function forget(target: TrackedTarget) {
            const key = getTrackedKey(target);
            const cancelTimer = timers.get(key);
            if (!cancelTimer) {
                return false;
            }

            cancelTimer();
            timers.delete(key);
            entriesRef.value = entriesRef.value.filter(entry => getTrackedKey(entry.target) !== key);
            return true;
        }
    },
});
