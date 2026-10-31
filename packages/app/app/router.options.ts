import type { RouterConfig } from 'nuxt/schema';
import type { RouteRecordRaw } from 'vue-router';

import { OAUTH_CALLBACK_PATH } from '@githq/github/oauth.js';

import { ACCOUNT_PATH } from '@/account/accountRoutes.js';
import { SIGN_IN_PATH, TRACKING_CHOICE_PATH, TRACKING_PATH } from '@/auth/routeAccess.js';
import { ITEM_PAGE_PATHS } from '@/item/itemRoutes.js';
import { MY_WORK_GROUP_PATH } from '@/myWork/myWorkRoutes.js';
import { FIRST_DOWNLOAD_PATH, PROJECT_PATHS, REPOSITORY_PATH } from '@/tracking/trackingRoutes.js';

// The only place routes are declared. Routes Nuxt would scan from files are not used (`nuxt.config.ts` fails
// the build if any exist). Who may open each one is its `meta.auth` (`auth/routeAccess.ts`); the app's screens
// sit in the shell (`meta.layout: 'shell'`, `layouts/shell.vue`).
// https://router.vuejs.org/api/interfaces/routeroptions.html
export default {
    routes: () => [...getRoutes()],
} satisfies RouterConfig;

function* getRoutes(): Generator<RouteRecordRaw> {
    // "My work", and narrowed to one of its groups; one page instance for both (`key`).
    yield {
        path: '/',
        name: 'my-work',
        component: () => import('@/myWork/MyWorkPage.vue'),
        meta: { auth: 'signedIn', layout: 'shell', key: 'my-work' },
    };
    yield {
        path: MY_WORK_GROUP_PATH,
        name: 'my-work-group',
        component: () => import('@/myWork/MyWorkPage.vue'),
        meta: { auth: 'signedIn', layout: 'shell', key: 'my-work' },
    };
    // An item on a page of its own, at GitHub's address of it; one page instance for both (`key`), so stepping
    // from an issue to a pull request keeps it.
    for (const [index, path] of ITEM_PAGE_PATHS.entries()) {
        yield {
            path,
            name: index === 0 ? 'item-issue' : 'item-pull',
            component: () => import('@/item/ItemPage.vue'),
            meta: { auth: 'signedIn', layout: 'shell', key: 'item', itemPage: true },
        };
    }
    // The first sign-in (D20): choosing what to track (G2), then the first download (G6) — full screens of their
    // own, before the shell.
    yield {
        path: TRACKING_CHOICE_PATH,
        name: 'tracking-choice',
        component: () => import('@/tracking/TrackingChoicePage.vue'),
        meta: { auth: 'signedIn', firstSignIn: 'choose' },
    };
    yield {
        path: FIRST_DOWNLOAD_PATH,
        name: 'first-download',
        component: () => import('@/tracking/FirstDownloadPage.vue'),
        meta: { auth: 'signedIn', firstSignIn: 'download' },
    };
    // Changing what is tracked, later (G8).
    yield {
        path: TRACKING_PATH,
        name: 'tracking',
        component: () => import('@/tracking/TrackingPage.vue'),
        meta: { auth: 'signedIn', layout: 'shell' },
    };
    // The account (G9).
    yield {
        path: ACCOUNT_PATH,
        name: 'account',
        component: () => import('@/account/AccountPage.vue'),
        meta: { auth: 'signedIn', layout: 'shell' },
    };
    // A repository's and a project's views, at GitHub's addresses of them.
    yield {
        path: REPOSITORY_PATH,
        name: 'repository',
        component: () => import('@/repository/RepositoryPage.vue'),
        meta: { auth: 'signedIn', layout: 'shell' },
    };
    for (const [index, path] of PROJECT_PATHS.entries()) {
        yield {
            path,
            name: index === 0 ? 'project-org' : 'project-user',
            component: () => import('@/projects/ProjectPage.vue'),
            meta: { auth: 'signedIn', layout: 'shell' },
        };
    }
    yield {
        path: SIGN_IN_PATH,
        name: 'sign-in',
        component: () => import('@/auth/SignInPage.vue'),
        meta: { auth: 'signedOut' },
    };
    // Where GitHub sends the browser back; open to everyone, it finishes the sign-in itself.
    yield {
        path: OAUTH_CALLBACK_PATH,
        name: 'auth-callback',
        component: () => import('@/auth/AuthCallbackPage.vue'),
    };
    // An address the app does not know opens "My work" (or sign-in, through the guard).
    yield {
        path: '/:path(.*)*',
        redirect: '/',
    };
}
