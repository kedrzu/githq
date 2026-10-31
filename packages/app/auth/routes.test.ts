/// <reference types="bun" />
import { expect, test } from 'bun:test';
import type { RouteRecordRaw } from 'vue-router';

import routerOptions from '@/app/router.options.js';

import type { RouteAuth } from './routeAccess.js';
import { resolveRouteAccess } from './routeAccess.js';

// The guard's rules are tested in `routeAccess.test.ts`; these check that every route of the app is declared
// under them as it should be.

const routes: RouteRecordRaw[] = routerOptions.routes();

/** The routes open without signing in, by what they are for; the catch-all only redirects. */
const NOT_SIGNED_IN = new Map<string, RouteAuth | undefined>([
    ['/sign-in', 'signedOut'],
    ['/auth/callback', undefined],
    ['/:path(.*)*', undefined],
]);

test('every screen of the app is for signed-in users; a signed-out visitor is sent to sign in', () => {
    const app = routes.filter(route => !NOT_SIGNED_IN.has(route.path));
    expect(app.map(route => route.path)).toEqual(expect.arrayContaining(['/']));

    for (const route of app) {
        expect(route.meta?.auth, route.path).toBe('signedIn');
        expect(
            resolveRouteAccess(
                { fullPath: route.path, query: {}, meta: route.meta ?? {} },
                { signedIn: false, failure: null, trackingChosen: false },
            ),
            route.path,
        ).toEqual({
            path: '/sign-in',
            query: { next: route.path },
        });
    }
});

test('the other routes keep their own access; an unknown address goes to the app', () => {
    for (const [path, auth] of NOT_SIGNED_IN) {
        const route = routes.find(candidate => candidate.path === path);
        expect(route, path).toBeDefined();
        expect(route?.meta?.auth, path).toBe(auth);
    }

    expect(routes.find(route => route.path === '/:path(.*)*')?.redirect).toBe('/');
});
