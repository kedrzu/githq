import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import type { RouteLocation, RouteLocationNormalized, Router } from 'vue-router';

import { AccountSession } from '@/auth/AccountSession.js';
import { AuthStore } from '@/auth/AuthStore.js';
import { createAccountSlot } from '@/auth/createAccountSlot.js';
import { HOME_PATH } from '@/auth/routeAccess.js';
import { Browser } from '@/services/Browser.js';
import { getRouteNameWithOwner, isTrackedOnlyRoute } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

/** Where the last screen is kept, per user: `githq.lastScreen.<login>`. */
const KEY_PREFIX = 'githq.lastScreen.';

/**
 * Opens the app on the screen it showed last: the desktop app on every launch, whose window always loads `/`, and the
 * web app entered at its bare address. Every screen the signed-in user navigates to is kept, on this device only and
 * forgotten when they sign out; the page's first guarded navigation, when it goes to a bare `/` typed as it is, goes on
 * to the kept screen instead. Anything else — a reload of another screen, `/login` settling on home, a link the desktop
 * app was opened with (pushed later, `desktop/OpenedLinks.vue`), going home inside the app — is left alone.
 */
export type LastScreen = Resolved<typeof LastScreen>;
export const LastScreen = defineService({
    name: 'LastScreen',
    deps: {
        accounts: AccountSession,
        auth: AuthStore,
        browser: Browser,
        tracking: TrackingStore,
    },
    setup({ accounts, auth, browser, tracking }) {
        const slot = createAccountSlot<string | null>({
            accounts,
            browser,
            keyPrefix: KEY_PREFIX,
            parse: stored => (typeof stored === 'string' ? stored : null),
            follow: () => undefined,
        });

        return { install };

        /**
         * Keeps the screens `router` goes to, and — with `restore` — sends its first guarded navigation on to the kept
         * one. Installed before Nuxt's first guarded navigation, made in `app:created`; its very first navigation is
         * made before any guard exists, so the first one a guard sees is that one, whatever its `from`.
         */
        function install(router: Router, restore: boolean) {
            router.afterEach((to, _from, failure) => {
                if (!failure && isScreen(to)) {
                    // Home without its query: a sign-in's failure or where to go after it belongs to that moment only.
                    slot.save(to.meta.auth === 'home' ? to.path : to.fullPath);
                }
            });

            if (!restore) {
                return;
            }

            const stop = router.beforeEach(async to => {
                stop();
                if (!isBareHome(to)) {
                    return undefined;
                }

                await auth.ready();
                const kept = slot.read();
                return kept !== null && (await isRestorable(router, kept)) ? kept : undefined;
            });
        }

        /** Whether `kept` still opens a screen worth coming back to, and only an address of the app's own. */
        async function isRestorable(router: Router, kept: string) {
            // `//host` would leave the app.
            if (!kept.startsWith('/') || kept.startsWith('//') || kept === HOME_PATH) {
                return false;
            }

            const target = router.resolve(kept);
            if (!isScreen(target)) {
                return false;
            }

            // A repository untracked since would hand its address off to github.com.
            if (isTrackedOnlyRoute(target)) {
                await tracking.ready();
                return tracking.isTracked({ kind: 'repository', nameWithOwner: getRouteNameWithOwner(target) });
            }

            return true;
        }
    },
});

/**
 * Whether a route is a screen of the app worth coming back to: one its guard opens (`meta.auth`), but not a step of the
 * first sign-in. Not the OAuth callback, a page handed off to GitHub or an address that only redirects.
 */
function isScreen(route: RouteLocation | RouteLocationNormalized) {
    return route.matched.length > 0 && route.meta.auth !== undefined && route.meta.firstSignIn === undefined;
}

/** Whether the app was opened at its bare address: `/` as it is, not reached through a redirect (`/login`). */
function isBareHome(to: RouteLocationNormalized) {
    return (
        to.path === HOME_PATH && Object.keys(to.query).length === 0 && to.hash === '' && to.redirectedFrom === undefined
    );
}
