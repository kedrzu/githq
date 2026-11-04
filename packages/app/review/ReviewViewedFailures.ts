import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';

/** Viewed marks GitHub didn't take: they went back to what they were. */
export interface ReviewViewedFailure {
    readonly id: number;
    readonly paths: readonly string[];
    /** GitHub's words. */
    readonly message: string;
}

/**
 * The latest viewed marks that failed, for a toast the shell shows wherever the user has gone by the time GitHub answers.
 * On its own, away from `ReviewFiles`, so that the shell doesn't load the review's code. It names files of private
 * repositories, so it goes with who signed out.
 */
export type ReviewViewedFailures = Resolved<typeof ReviewViewedFailures>;
export const ReviewViewedFailures = defineService({
    name: 'ReviewViewedFailures',
    deps: { accounts: AccountSession },
    setup({ accounts }) {
        const latestRef = shallowRef<ReviewViewedFailure | null>(null);
        let nextId = 1;

        accounts.onChange(dismiss);

        return {
            /** Reactive. */
            get latest() {
                return latestRef.value;
            },
            report,
            dismiss,
        };

        function report(paths: readonly string[], message: string) {
            latestRef.value = { id: nextId++, paths, message };
        }

        function dismiss() {
            latestRef.value = null;
        }
    },
});
