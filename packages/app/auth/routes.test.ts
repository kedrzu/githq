/// <reference types="bun" />
import { expect, test } from 'bun:test';
import type { RouteRecordRaw } from 'vue-router';

import routerOptions from '@/app/router.options.js';
import { GITHUB_RESERVED_SEGMENTS } from '@/tracking/trackingRoutes.js';

import type { RouteAuth } from './routeAccess.js';
import { resolveRouteAccess } from './routeAccess.js';

// The guard's rules are tested in `routeAccess.test.ts`; these check that every route of the app is declared
// under them as it should be.

const routes: RouteRecordRaw[] = routerOptions.routes();

/** The screens open without signing in, by what they are for; redirects show nothing and are left out. */
const NOT_SIGNED_IN = new Map<string, RouteAuth | undefined>([
    ['/login', 'signedOut'],
    ['/auth/callback', undefined],
    // The hand-off to github.com: nothing of the user's is shown, so signed out too.
    ['/:path(.*)*', undefined],
    ...GITHUB_RESERVED_SEGMENTS.map(segment => [`/${segment}/:rest(.*)*`, undefined] as const),
]);

/** The routes that show something; a redirect record has no component and no access of its own. */
const screens = routes.filter(route => route.component);

test('every screen of the app is for signed-in users; a signed-out visitor is sent to sign in', () => {
    const app = screens.filter(route => !NOT_SIGNED_IN.has(route.path));
    expect(app.map(route => route.path)).toEqual(expect.arrayContaining(['/', '/settings', '/issues/assigned']));

    for (const route of app) {
        expect(route.meta?.auth, route.path).toBe('signedIn');
        expect(
            resolveRouteAccess(
                { fullPath: route.path, query: {}, meta: route.meta ?? {} },
                { signedIn: false, failure: null, trackingChosen: false },
            ),
            route.path,
        ).toEqual({
            path: '/login',
            query: { next: route.path },
        });
    }
});

test('the other routes keep their own access; an unknown address is handed off to GitHub', () => {
    for (const [path, auth] of NOT_SIGNED_IN) {
        const route = screens.find(candidate => candidate.path === path);
        expect(route, path).toBeDefined();
        expect(route?.meta?.auth, path).toBe(auth);
    }

    const catchAll = routes.find(route => route.path === '/:path(.*)*');
    expect(catchAll?.redirect).toBeUndefined();
    expect(catchAll?.name).toBe('github');
});

test('redirects carry no access rules of their own: the guard applies those of where they lead', () => {
    for (const route of routes.filter(candidate => !candidate.component)) {
        expect(route.redirect, route.path).toBeDefined();
        expect(route.meta?.auth, route.path).toBeUndefined();
    }
});
