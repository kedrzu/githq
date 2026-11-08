import { defineNuxtPlugin } from 'nuxt/app';

import { syncSkeletonClock } from '@/components/skeletonClock.js';

/** Every skeleton's band on one clock, however late it mounts. */
export default defineNuxtPlugin({
    name: 'skeleton-clock-plugin',
    setup() {
        syncSkeletonClock();
    },
});
