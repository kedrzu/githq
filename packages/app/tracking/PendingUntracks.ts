import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { computed, shallowRef, watch } from 'vue';

import { Browser } from '@/services/Browser.js';

import { TrackingStore } from './TrackingStore.js';
import type { TrackedTarget } from './TrackingTypes.js';
import { getTrackedKey } from './utils/getTrackedKey.js';

/** A repository or project the user stopped tracking, with Undo still on offer. */
export interface PendingUntrack {
    readonly target: TrackedTarget;
    /** What the toast calls it: `owner/name`, a project's title. */
    readonly label: string;
}

/**
 * Untracking with Undo (D25, T20): the entry leaves what the app lists at once, and only when its toast closes
 * (`UntrackToast`: timed out or dismissed — its own time, which hover pauses) or the page hides does it become a plain
 * `TrackingStore.untrack`. The toast is the shell's, there whenever someone is signed in to untrack anything; signed
 * out, what is pending is forgotten (below). Until then the settings stay
 * as they were, so it is kept and synced as ever: anything not tracked is evicted by whichever tab leads sync, and
 * its sync state would keep a later re-track from downloading it again.
 *
 * An entry no longer tracked is forgotten, so nothing is committed for it — untracked elsewhere (another tab, another
 * device's synced settings), or another account or none signed in, which empties what the store tracks at that very moment.
 * A service, so it outlives the route: moving between screens keeps the toast and Undo.
 */
export type PendingUntracks = Resolved<typeof PendingUntracks>;
export const PendingUntracks = defineService({
    name: 'PendingUntracks',
    deps: {
        browser: Browser,
        tracking: TrackingStore,
    },
    setup({ browser, tracking }) {
        /** Oldest first. */
        const entriesRef = shallowRef<readonly PendingUntrack[]>([]);
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
            /** What is pending, oldest first: a toast each. Reactive. */
            get entries(): readonly PendingUntrack[] {
                return entriesRef.value;
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

        /** Makes it pending; nothing when it is not tracked, or is pending already (it keeps its toast). */
        function untrack(target: TrackedTarget, label: string) {
            if (!tracking.isTracked(target) || isPending(target)) {
                return;
            }

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
            if (!isPending(target)) {
                return false;
            }

            const key = getTrackedKey(target);
            entriesRef.value = entriesRef.value.filter(entry => getTrackedKey(entry.target) !== key);
            return true;
        }
    },
});
