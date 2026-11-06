import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { computed, shallowRef, watch } from 'vue';

import { Clock } from '@/services/Clock.js';

import { TrackingStore } from './TrackingStore.js';
import type { TrackedTarget } from './TrackingTypes.js';

/** The pace is told only after this long, so a first page read at once does not promise seconds. */
const PACE_AFTER_MS = 5000;

/** The download of everything tracked, summed: what the status bar's left segment says while it lasts (first run and loading D4, D11). */
export interface OverallDownload {
    /** Items read so far, of every repository and project still downloading or done. */
    readonly done: number;
    /** Items GitHub counts in all of them; `null` while any has not counted its items yet. */
    readonly total: number | null;
    /** Roughly how long is left, once a pace is known; `null` before. */
    readonly secondsLeft: number | null;
    /** How many tracked repositories are still downloading. */
    readonly repositories: number;
    /** How many tracked projects are still downloading. */
    readonly projects: number;
}

/**
 * How far the download of every tracked repository and project is (first run and loading D4): the sum of each one's
 * progress — those GitHub does not show to the user left out — and the time left, from the pace since the download
 * was first seen under way, told only after {@link PACE_AFTER_MS}. App-wide, so a repository tracked later is told
 * the same as the first sign-in's; once everything arrived there is nothing to tell, and the next download starts its
 * pace afresh.
 */
export type DownloadProgress = Resolved<typeof DownloadProgress>;
export const DownloadProgress = defineService({
    name: 'DownloadProgress',
    deps: {
        clock: Clock,
        tracking: TrackingStore,
    },
    setup({ clock, tracking }) {
        const progress = computed(() => {
            let done = 0;
            let total: number | null = 0;
            let repositories = 0;
            let projects = 0;
            const targets: TrackedTarget[] = [
                ...tracking.repositories.map((repository): TrackedTarget => ({
                    kind: 'repository',
                    nameWithOwner: repository.nameWithOwner,
                })),
                ...tracking.projects.map((project): TrackedTarget => ({ kind: 'project', id: project.id })),
            ];
            for (const target of targets) {
                const current = tracking.getProgress(target);
                if (current.state === 'hidden') {
                    continue;
                }

                done += current.done;
                total = total === null || current.total === null ? null : total + current.total;
                if (current.state === 'downloading') {
                    if (target.kind === 'repository') {
                        repositories++;
                    } else {
                        projects++;
                    }
                }
            }

            return { done, total, repositories, projects, finished: repositories + projects === 0 };
        });

        /** Where the pace is counted from: when the download was first seen under way, and what had arrived by then. */
        const startRef = shallowRef<{ readonly at: number; readonly done: number } | null>(null);
        watch(
            progress,
            ({ finished, done }) => {
                const start = startRef.value;
                if (finished) {
                    startRef.value = null;
                } else if (!start || done < start.done) {
                    // Under way from now — or something left what is summed (untracked), and the pace so far means nothing.
                    startRef.value = { at: clock.now(), done };
                }
            },
            { immediate: true, flush: 'sync' },
        );

        const current = computed((): OverallDownload | null => {
            const { done, total, repositories, projects, finished } = progress.value;
            const start = startRef.value;
            if (finished || !start) {
                return null;
            }

            // Read when what arrived moves, which is when the pace is worth telling again.
            const elapsed = clock.now() - start.at;
            const pace = elapsed >= PACE_AFTER_MS ? (done - start.done) / elapsed : 0;
            return {
                done,
                total,
                secondsLeft: total !== null && pace > 0 ? Math.max(1, Math.round((total - done) / pace / 1000)) : null,
                repositories,
                projects,
            };
        });

        return {
            /** The download under way, summed; `null` once every tracked repository and project has all its items. Reactive. */
            get current() {
                return current.value;
            },
        };
    },
});
