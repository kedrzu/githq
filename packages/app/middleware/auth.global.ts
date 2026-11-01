import { defineNuxtRouteMiddleware, navigateTo, useNuxtApp } from '#app';
import { useService } from '@nzyme/vue-ioc/useService.js';

import { AuthStore } from '@/auth/AuthStore.js';
import { resolveRouteAccess } from '@/auth/routeAccess.js';
import { ItemStore } from '@/store/ItemStore.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import { isHydratingServerHtml } from '@/utils/isHydratingServerHtml.js';

/**
 * The route guard: who may open which route (`meta.auth`, rules in `auth/routeAccess.ts`). It waits only when
 * a stored token's user is not known yet, and for the signed-in user's local copy to be read (IndexedDB, no
 * network) — which also says whether they chose what to track (G2); with a known user the app opens at once.
 *
 * It also sets the layout of home (`meta.auth: 'home'`): the shell signed in, none for the landing page. In the
 * browser only — the session lives there; the server renders home as the landing page, with no layout.
 */
export default defineNuxtRouteMiddleware(async to => {
    if (import.meta.server || !to.meta.auth) {
        return undefined;
    }

    // Resolved before the first `await`: the service comes from the app's injection context.
    const nuxtApp = useNuxtApp();
    const auth = useService(AuthStore);
    const items = useService(ItemStore);
    const tracking = useService(TrackingStore);
    await auth.ready();
    // A list renders what was kept from the last session at once, before anything comes from GitHub.
    await items.ready();
    await tracking.ready();

    const redirect = resolveRouteAccess(to, {
        signedIn: auth.signedIn,
        failure: auth.failure,
        trackingChosen: tracking.chosen,
    });
    if (redirect) {
        return navigateTo(redirect, { replace: true });
    }

    if (to.meta.auth === 'home') {
        // Set on the route, not with `setPageLayout`, which would stick to the next route of the same path.
        // Hydrating the server's landing page, the shell waits until it is hydrated (`meta` is reactive).
        if (auth.signedIn && isHydratingServerHtml(nuxtApp)) {
            to.meta.layout = false;
            nuxtApp.hooks.hookOnce('app:suspense:resolve', () => {
                to.meta.layout = 'shell';
            });
        } else {
            to.meta.layout = auth.signedIn ? 'shell' : false;
        }
    }

    return undefined;
});
