import { useService } from '@nzyme/vue-ioc/useService.js';
import { defineNuxtPlugin, useNuxtApp, useRouter } from 'nuxt/app';

import { AuthStore } from '@/auth/AuthStore.js';
import { Browser } from '@/services/Browser.js';
import { installLastScreen } from '@/shell/lastScreen.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import { isHydratingServerHtml } from '@/utils/isHydratingServerHtml.js';

/** Opens the app at its bare address on the screen it showed last (`shell/lastScreen.ts`), on the web and on desktop. */
export default defineNuxtPlugin({
    name: 'last-screen-plugin',
    dependsOn: ['ioc-plugin'],
    setup(nuxtApp) {
        const { browser, auth, tracking } = nuxtApp.vueApp.runWithContext(() => ({
            browser: useService(Browser),
            auth: useService(AuthStore),
            tracking: useService(TrackingStore),
        }));

        installLastScreen({
            router: useRouter(),
            storage: browser.localStorage,
            auth,
            tracking,
            // The landing page the server rendered for `/` is hydrated as it is.
            restore: !isHydratingServerHtml(useNuxtApp()),
        });
    },
});
