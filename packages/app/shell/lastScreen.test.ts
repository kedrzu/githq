/// <reference types="bun" />
import { expect, test } from 'bun:test';
import type { RouteRecordRaw } from 'vue-router';
import { createMemoryHistory, createRouter } from 'vue-router';

import routerOptions from '@/app/router.options.js';
import { TRACKING_CHOICE_PATH } from '@/auth/routeAccess.js';
import type { TrackedTarget } from '@/tracking/TrackingTypes.js';

import { installLastScreen } from './lastScreen.js';

const KEY = 'githq.lastScreen';
const PULL = '/acme/web/pull/7?tab=files';
const RUN = '/acme/web/actions/runs/42';

test('a launch at the bare address opens the screen shown last, and going home afterwards stays home', async () => {
    const app = await launch({ kept: PULL });
    expect(app.router.currentRoute.value.fullPath).toBe(PULL);

    await app.router.push('/');
    expect(app.router.currentRoute.value.fullPath).toBe('/');
    expect(app.stored.get(KEY)).toBe('/');
});

test('a launch at any other address, or by a user signed out, stays where it was opened', async () => {
    const elsewhere = await launch({ kept: PULL, at: '/pulls' });
    expect(elsewhere.router.currentRoute.value.fullPath).toBe('/pulls');

    const withQuery = await launch({ kept: PULL, at: '/?failed=tokenRejected' });
    expect(withQuery.router.currentRoute.value.fullPath).toBe('/?failed=tokenRejected');

    const signedOut = await launch({ kept: PULL, signedIn: false });
    expect(signedOut.router.currentRoute.value.fullPath).toBe('/');

    const hydrating = await launch({ kept: PULL, restore: false });
    expect(hydrating.router.currentRoute.value.fullPath).toBe('/');
});

test('a kept address that is not a screen of the app, or of a repository no longer tracked, is not opened', async () => {
    for (const kept of ['//evil.example/acme', 'https://evil.example/', '/auth/callback', '/settings/tracking']) {
        const app = await launch({ kept });
        expect(app.router.currentRoute.value.fullPath).toBe('/');
    }

    const untracked = await launch({ kept: RUN, tracked: [] });
    expect(untracked.router.currentRoute.value.fullPath).toBe('/');

    const tracked = await launch({ kept: RUN, tracked: ['acme/web'] });
    expect(tracked.router.currentRoute.value.fullPath).toBe(RUN);
});

test('home is kept without its query, and a step of the first sign-in is not kept at all', async () => {
    const app = await launch({});

    await app.router.push('/?failed=tokenRejected&next=%2Fpulls');
    expect(app.stored.get(KEY)).toBe('/');

    await app.router.push(PULL);
    await app.router.push(TRACKING_CHOICE_PATH);
    expect(app.stored.get(KEY)).toBe(PULL);
});

interface LaunchOptions {
    kept?: string;
    at?: string;
    signedIn?: boolean;
    restore?: boolean;
    tracked?: readonly string[];
}

/** A window launched as Nuxt launches it: a first navigation before any guard exists, then the guarded one. */
async function launch({ kept, at = '/', signedIn = true, restore = true, tracked = [] }: LaunchOptions) {
    const stored = new Map<string, string>(kept === undefined ? [] : [[KEY, kept]]);
    const router = createRouter({ history: createMemoryHistory(), routes: routerOptions.routes().map(stubComponent) });
    await router.push(at);

    installLastScreen({
        router,
        storage: {
            getItem: key => stored.get(key) ?? null,
            setItem: (key, value) => stored.set(key, value),
            removeItem: key => stored.delete(key),
        },
        auth: { ready: () => Promise.resolve(), signedIn },
        tracking: {
            ready: () => Promise.resolve(),
            isTracked: (target: TrackedTarget) =>
                target.kind === 'repository' && tracked.includes(target.nameWithOwner),
        },
        restore,
    });
    await router.replace({ path: router.currentRoute.value.path, query: router.currentRoute.value.query, force: true });

    return { router, stored };
}

/** The route with a component that needs no loading: navigating here only tells where it ends. */
function stubComponent(route: RouteRecordRaw): RouteRecordRaw {
    return 'component' in route && route.component ? { ...route, component: {} } : route;
}
