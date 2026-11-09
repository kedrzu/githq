import { defineNuxtPlugin, useRouter } from 'nuxt/app';

import { onRoutePageShown, saveRouteScroll } from '@/shell/routeScroll.js';

/** Feeds the router's scroll of the screens (`shell/routeScroll.ts`) what only Nuxt knows: before and after a screen changes. */
export default defineNuxtPlugin({
    name: 'route-scroll-plugin',
    setup(nuxtApp) {
        useRouter().beforeEach(() => {
            saveRouteScroll();
        });
        nuxtApp.hook('page:loading:end', onRoutePageShown);
    },
});
