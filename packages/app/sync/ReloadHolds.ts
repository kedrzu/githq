import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef } from 'vue';

/**
 * What components keep from being lost to a reload of the tab (`OutdatedTabReload`): text only they hold. On its own,
 * so a small component does not bring in all that the reload watches.
 */
export type ReloadHolds = Resolved<typeof ReloadHolds>;
export const ReloadHolds = defineService({
    name: 'ReloadHolds',
    setup() {
        const holdsRef = shallowRef<readonly (() => boolean)[]>([]);

        return {
            /** Whether any hold says so now; reactive. */
            get held() {
                return holdsRef.value.some(isHeld => isHeld());
            },
            /** Keeps the tab from reloading while `isHeld`, reactive, says so. Returns what ends that. */
            holdWhile(isHeld: () => boolean) {
                holdsRef.value = [...holdsRef.value, isHeld];
                return () => {
                    holdsRef.value = holdsRef.value.filter(other => other !== isHeld);
                };
            },
        };
    },
});
