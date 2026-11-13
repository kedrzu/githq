/// <reference types="bun" />
// IndexedDB for bun; every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';
import type { RouteRecordRaw } from 'vue-router';
import { createMemoryHistory, createRouter } from 'vue-router';

import routerOptions from '@/app/router.options.js';
import { TRACKING_CHOICE_PATH } from '@/auth/routeAccess.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { uniqueLogin } from '@/testing/uniqueLogin.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { LastScreen } from './LastScreen.js';

const PULL = '/acme/web/pull/7?tab=files';
const RUN = '/acme/web/actions/runs/42';

test('the bare address opens the screen shown last, and going home afterwards stays home', async () => {
    const login = uniqueLogin();
    const first = await launch({ login });
    await first.router.push(PULL);

    const next = await launch({ login, localStorage: first.localStorage });
    expect(next.router.currentRoute.value.fullPath).toBe(PULL);

    await next.router.push('/');
    expect(next.router.currentRoute.value.fullPath).toBe('/');
});

test('any other address, `/login` settling on home, or the server’s landing page stays where it was opened', async () => {
    const login = uniqueLogin();
    const first = await launch({ login });
    await first.router.push(PULL);
    const { localStorage } = first;

    // Each from the same kept screen: a page opened keeps its own.
    for (const at of ['/pulls', '/?failed=tokenRejected', '/login']) {
        const app = await launch({ login, localStorage: new Map(localStorage), at });
        expect(app.router.currentRoute.value.path).toBe(at === '/pulls' ? '/pulls' : '/');
    }

    const hydrating = await launch({ login, localStorage: new Map(localStorage), restore: false });
    expect(hydrating.router.currentRoute.value.fullPath).toBe('/');
});

test('the last screen is the user’s own, and is forgotten when they sign out', async () => {
    const first = await launch({ login: 'octocat' });
    await first.router.push(PULL);

    const other = await launch({ login: 'hubot', localStorage: first.localStorage });
    expect(other.router.currentRoute.value.fullPath).toBe('/');

    first.session.signOutFromAnotherTab();
    const again = await launch({ login: 'octocat', localStorage: first.localStorage });
    expect(again.router.currentRoute.value.fullPath).toBe('/');
});

test('home is kept without its query, and a step of the first sign-in is not kept at all', async () => {
    const login = uniqueLogin();
    const first = await launch({ login });
    await first.router.push(PULL);
    await first.router.push(TRACKING_CHOICE_PATH);
    expect((await launch({ login, localStorage: first.localStorage })).router.currentRoute.value.fullPath).toBe(PULL);

    await first.router.push('/pulls?failed=tokenRejected');
    expect((await launch({ login, localStorage: first.localStorage })).router.currentRoute.value.fullPath).toBe(
        '/pulls',
    );
});

test('a kept address that is not a screen of the app, or of a repository no longer tracked, is not opened', async () => {
    const login = uniqueLogin();
    for (const kept of ['//evil.example/acme', 'https://evil.example/', '/auth/callback', '/settings/tracking']) {
        const localStorage = new Map([[`githq.lastScreen.${login}`, JSON.stringify(kept)]]);
        const app = await launch({ login, localStorage });
        expect(app.router.currentRoute.value.fullPath).toBe('/');
    }

    const first = await launch({ login });
    const tracking = first.session.container.resolve(TrackingStore);
    await tracking.ready();
    tracking.choose({ repositories: [{ nameWithOwner: 'acme/web', id: 'R_web' }], projects: [] });
    await first.router.push(RUN);
    expect((await launch({ login, localStorage: first.localStorage })).router.currentRoute.value.fullPath).toBe(RUN);

    tracking.untrack({ kind: 'repository', nameWithOwner: 'acme/web' });
    expect((await launch({ login, localStorage: first.localStorage })).router.currentRoute.value.fullPath).toBe('/');
});

interface LaunchOptions {
    login: string | null;
    localStorage?: Map<string, string>;
    at?: string;
    restore?: boolean;
}

/** A page opened at `at` as Nuxt opens it: a first navigation before any guard exists, then the guarded one. */
async function launch({ login, localStorage, at = '/', restore = true }: LaunchOptions) {
    const session = createTestSession({ login, localStorage, answer: () => undefined });
    setIndexedDbPersistence(session.container);
    const router = createRouter({ history: createMemoryHistory(), routes: routerOptions.routes().map(stubComponent) });
    await router.push(at);

    session.container.resolve(LastScreen).install(router, restore);
    // Nuxt navigates again to the address the page was opened at, so a redirect of it is made again.
    const { path, query, hash } = router.resolve(at);
    await router.replace({ path, query, hash, force: true });

    return { session, router, localStorage: session.localStorage };
}

/** The route with a component that needs no loading: navigating here only tells where it ends. */
function stubComponent(route: RouteRecordRaw): RouteRecordRaw {
    return 'component' in route && route.component ? { ...route, component: {} } : route;
}
