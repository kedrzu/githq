import { useService } from '@nzyme/vue-ioc/useService.js';
import { defineNuxtPlugin, useRouter } from 'nuxt/app';
import { watch } from 'vue';

import { AuthStore } from '@/auth/AuthStore.js';

/**
 * Follows the session starting or ending under the current route — "Sign out", a token GitHub rejected, or a
 * sign-in or sign-out in another tab — by opening the route again, so the route guard sends the user where
 * they now belong: to the landing page from the app, or on into the app from the landing page. Home is opened
 * again either way: the guard sets its layout (the shell, or none for the landing page) as it opens it.
 */
export default defineNuxtPlugin({
    name: 'session-plugin',
    dependsOn: ['ioc-plugin'],
    setup(nuxtApp) {
        const auth = nuxtApp.vueApp.runWithContext(() => useService(AuthStore));
        const router = useRouter();

        watch(
            () => auth.signedIn,
            signedIn => {
                const route = router.currentRoute.value;
                if (route.meta.auth === 'home' || (route.meta.auth === 'signedIn' && !signedIn)) {
                    void router.replace({ path: route.path, query: route.query, hash: route.hash, force: true });
                }
            },
        );
    },
});
