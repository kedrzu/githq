import { useService } from '@nzyme/vue-ioc/useService.js';
import { defineNuxtPlugin, useRouter } from 'nuxt/app';

import { AuthStore } from '@/auth/AuthStore.js';
import { DesktopHandOff } from '@/desktopLinks/DesktopHandOff.js';

/**
 * Takes the decision to hand the page's links off to the desktop app (web builds only; nothing in the desktop build):
 * once, on the page's first navigation, redirects included, it records whether that route is a shell screen with the
 * user signed in (`desktopLinks/DesktopHandOff.ts`). The shell mounted by a sign-in or a step of the first sign-in
 * later in the same page load finds it was not.
 */
export default defineNuxtPlugin({
    name: 'desktop-links-plugin',
    dependsOn: ['ioc-plugin'],
    setup(nuxtApp) {
        if (__DESKTOP__) {
            return;
        }

        const { auth, handOff } = nuxtApp.vueApp.runWithContext(() => ({
            auth: useService(AuthStore),
            handOff: useService(DesktopHandOff),
        }));
        const router = useRouter();

        // Nuxt's router plugin makes the first navigation in `app:created`, after every plugin is set up. A redirect of
        // the guard ends that navigation without `afterEach`; the one it redirects to is the first that ends.
        const stop = router.afterEach((to, _from, failure) => {
            stop();
            // Home's layout is set by the guard, and left off while the server's landing page is hydrated.
            const onShell = to.meta.layout === 'shell' || to.meta.auth === 'home';
            handOff.recordFirstRoute(!failure && onShell && auth.signedIn ? to.fullPath : null);
        });
    },
});
