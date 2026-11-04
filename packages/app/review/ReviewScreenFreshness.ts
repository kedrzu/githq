import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef } from 'vue';

import type { Freshness } from '@/sync/Freshness.js';

/**
 * How fresh the review on screen is, for the shell's status bar. On its own, away from `ReviewFiles`, so that the shell
 * doesn't load the review's code.
 */
export type ReviewScreenFreshness = Resolved<typeof ReviewScreenFreshness>;
export const ReviewScreenFreshness = defineService({
    name: 'ReviewScreenFreshness',
    setup() {
        const shownRef = shallowRef<(() => Freshness) | null>(null);

        return {
            /** `null` with no review on screen. Reactive. */
            get current() {
                return shownRef.value?.() ?? null;
            },
            show,
        };

        /** Says `read` of the screen, until the function returned is called. */
        function show(read: () => Freshness) {
            shownRef.value = read;
            return () => {
                if (shownRef.value === read) {
                    shownRef.value = null;
                }
            };
        }
    },
});
