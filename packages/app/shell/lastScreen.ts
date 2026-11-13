import type { RouteLocation, RouteLocationNormalized, Router } from 'vue-router';

import type { AuthStore } from '@/auth/AuthStore.js';
import { HOME_PATH } from '@/auth/routeAccess.js';
import type { BrowserStorage } from '@/services/Browser.js';
import { getRouteNameWithOwner, isTrackedOnlyRoute } from '@/tracking/trackingRoutes.js';
import type { TrackingStore } from '@/tracking/TrackingStore.js';

const LAST_SCREEN_KEY = 'githq.lastScreen';

/** What `installLastScreen` works with. */
export interface InstallLastScreenParams {
    router: Router;
    /** Where the last screen is kept: `localStorage`, shared by the browser's tabs. */
    storage: BrowserStorage;
    auth: Pick<AuthStore, 'ready' | 'signedIn'>;
    tracking: Pick<TrackingStore, 'isTracked' | 'ready'>;
    /** Whether the first navigation may go to the last screen: not while the server's landing page is hydrated. */
    restore: boolean;
}

/**
 * Opens the app on the screen it showed last: the desktop app on every launch, whose window always loads `/`, and
 * the web app entered at its bare address. Every screen navigated to is kept; the page's first guarded navigation, when
 * it goes to a bare `/` with the user signed in, goes on to the kept screen instead. Anything else — a reload of another
 * screen, a link the desktop app was opened with (pushed later, `desktop/OpenedLinks.vue`), going home inside the app —
 * is left alone. Install before Nuxt's first guarded navigation, made in `app:created`.
 */
export function installLastScreen({ router, storage, auth, tracking, restore }: InstallLastScreenParams) {
    router.afterEach((to, _from, failure) => {
        if (failure || !isScreen(to)) {
            return;
        }

        // Home without its query: a sign-in's failure or where to go after it belongs to that moment only.
        storage.setItem(LAST_SCREEN_KEY, to.meta.auth === 'home' ? to.path : to.fullPath);
    });

    if (!restore) {
        return;
    }

    // Nuxt's very first navigation is made before any guard exists, so the first one a guard sees is the guarded
    // navigation of `app:created`, whatever its `from`.
    const stop = router.beforeEach(async to => {
        stop();
        if (to.path !== HOME_PATH || Object.keys(to.query).length > 0 || to.hash !== '') {
            return undefined;
        }

        const kept = storage.getItem(LAST_SCREEN_KEY);
        // Only an address of the app's own: `//host` would leave it.
        if (kept === null || !kept.startsWith('/') || kept.startsWith('//') || kept === HOME_PATH) {
            return undefined;
        }

        await auth.ready();
        if (!auth.signedIn) {
            return undefined;
        }

        const target = router.resolve(kept);
        if (!isScreen(target)) {
            return undefined;
        }

        // A repository untracked since would hand its address off to github.com.
        if (isTrackedOnlyRoute(target)) {
            await tracking.ready();
            if (!tracking.isTracked({ kind: 'repository', nameWithOwner: getRouteNameWithOwner(target) })) {
                return undefined;
            }
        }

        return kept;
    });
}

/**
 * Whether a route is a screen of the app worth coming back to: one its guard opens (`meta.auth`), but not a step of the
 * first sign-in. Not the OAuth callback, a page handed off to GitHub or an address that only redirects.
 */
function isScreen(route: RouteLocation | RouteLocationNormalized) {
    return route.matched.length > 0 && route.meta.auth !== undefined && route.meta.firstSignIn === undefined;
}
