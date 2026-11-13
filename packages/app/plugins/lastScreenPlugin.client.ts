import { useService } from '@nzyme/vue-ioc/useService.js';
import { defineNuxtPlugin, useNuxtApp, useRouter } from 'nuxt/app';

import { LastScreen } from '@/shell/LastScreen.js';
import { isHydratingServerHtml } from '@/utils/isHydratingServerHtml.js';

/** Opens the app at its bare address on the screen it showed last (`shell/LastScreen.ts`), on the web and on desktop. */
export default defineNuxtPlugin({
    name: 'last-screen-plugin',
    dependsOn: ['ioc-plugin'],
    setup(nuxtApp) {
        const lastScreen = nuxtApp.vueApp.runWithContext(() => useService(LastScreen));
        // The landing page the server rendered for `/` is hydrated as it is.
        lastScreen.install(useRouter(), !isHydratingServerHtml(useNuxtApp()));
    },
});
