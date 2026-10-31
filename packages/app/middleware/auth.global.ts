import { defineNuxtRouteMiddleware, navigateTo } from '#app';
import { useService } from '@nzyme/vue-ioc/useService.js';

import { AuthStore } from '@/auth/AuthStore.js';
import { resolveRouteAccess } from '@/auth/routeAccess.js';
import { ItemStore } from '@/store/ItemStore.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

/**
 * The route guard: who may open which route (`meta.auth`, rules in `auth/routeAccess.ts`). It waits only when
 * a stored token's user is not known yet, and for the signed-in user's local copy to be read (IndexedDB, no
 * network) — which also says whether they chose what to track (G2); with a known user the app opens at once.
 */
export default defineNuxtRouteMiddleware(async to => {
    if (!to.meta.auth) {
        return undefined;
    }

    // Resolved before the first `await`: the service comes from the app's injection context.
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
    return redirect ? navigateTo(redirect, { replace: true }) : undefined;
});
