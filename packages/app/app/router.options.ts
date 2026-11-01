import type { RouterConfig } from 'nuxt/schema';
import type { LocationQueryRaw, RouteLocation, RouteLocationRaw, RouteRecordRaw } from 'vue-router';
import { stringifyQuery } from 'vue-router';

import { OAUTH_CALLBACK_PATH } from '@githq/github/oauth.js';

import { ACCOUNT_PATH } from '@/account/accountRoutes.js';
import { HOME_PATH, SIGN_IN_PATH, TRACKING_CHOICE_PATH, TRACKING_PATH } from '@/auth/routeAccess.js';
import { ITEM_PAGE_PATHS } from '@/item/itemRoutes.js';
import { MY_WORK_GROUP_PATHS } from '@/myWork/myWorkRoutes.js';
import { MY_WORK_GROUPS } from '@/store/ItemStoreTypes.js';
import {
    FIRST_DOWNLOAD_PATH,
    GITHUB_RESERVED_SEGMENTS,
    PROJECT_PATHS,
    REPOSITORY_PATH,
} from '@/tracking/trackingRoutes.js';

// The only place routes are declared. Routes Nuxt would scan from files are not used (`nuxt.config.ts` fails
// the build if any exist). Who may open each one is its `meta.auth` (`auth/routeAccess.ts`); the app's screens
// sit in the shell (`meta.layout: 'shell'`, `layouts/shell.vue`).
//
// Every address is GitHub's: swap the host and the same thing opens on github.com, and the other way round. The
// app's own pages sit under first segments GitHub reserves (`/settings/…`), so none is ever an owner's
// or a repository's address, and an address githq does not show is handed off to github.com
// (`shell/GitHubHandOffPage.vue`). A static first segment outranks a parameter, so `/orgs/acme` is never taken
// for a repository.
// https://router.vuejs.org/api/interfaces/routeroptions.html
export default {
    routes: () => [...getRoutes()],
    stringifyQuery: stringifyGitHubQuery,
} satisfies RouterConfig;

/**
 * A query written as GitHub writes it: vue-router leaves `|` as it is, GitHub encodes it as `%7C` (an item opened
 * over a list, `?pane=issue&issue=owner%7Cname%7C12`). Read back, both are the same.
 */
export function stringifyGitHubQuery(query: LocationQueryRaw | undefined) {
    return stringifyQuery(query ?? {}).replaceAll('|', '%7C');
}

/** One function for every home route, so moving between them keeps the page (`key: 'my-work'`). */
function HomePage() {
    return import('@/home/HomePage.vue');
}

function* getRoutes(): Generator<RouteRecordRaw> {
    // Home: "My work", and narrowed to one of its groups at GitHub's dashboard address of that list —
    // `/pulls/mentioned` too, for the mentioned group holds pull requests as well; one page instance for all (`key`).
    // Signed out, `/` is the landing page. The guard sets the layout (`middleware/auth.global.ts`): the shell
    // signed in, none for the landing page — which is also what the server renders.
    yield {
        path: HOME_PATH,
        name: 'my-work',
        component: HomePage,
        meta: { auth: 'home', layout: false, key: 'my-work' },
    };
    for (const group of MY_WORK_GROUPS) {
        yield {
            path: MY_WORK_GROUP_PATHS[group],
            alias: group === 'mentioned' ? ['/pulls/mentioned'] : [],
            name: `my-work-${group}`,
            component: HomePage,
            meta: { auth: 'home', layout: false, key: 'my-work', myWorkGroup: group },
        };
    }
    // An item on a page of its own, at GitHub's address of it; one page instance for both (`key`), so stepping
    // from an issue to a pull request keeps it.
    for (const [index, path] of ITEM_PAGE_PATHS.entries()) {
        yield {
            path,
            name: index === 0 ? 'item-issue' : 'item-pull',
            component: () => import('@/item/ItemPage.vue'),
            meta: { auth: 'signedIn', layout: 'shell', key: 'item', itemPage: true },
        };
        // GitHub's addresses under an item (a pull request's `/files`, `/commits`, `/checks`, …) settle on the
        // item's own, keeping the query and the fragment.
        yield {
            path: `${path}/:rest(.*)+`,
            redirect: to => getItemPageRedirect(to, index === 0 ? 'item-issue' : 'item-pull'),
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
    // A repository's and a project's views, at GitHub's addresses of them. One repository page instance for the
    // repository and its lists of issues and pull requests (`key`), so switching between them keeps the screen.
    yield {
        path: REPOSITORY_PATH,
        name: 'repository',
        component: () => import('@/repository/RepositoryPage.vue'),
        meta: { auth: 'signedIn', layout: 'shell', key: getRepositoryPageKey },
    };
    for (const [index, path] of PROJECT_PATHS.entries()) {
        yield {
            path,
            name: index === 0 ? 'project-org' : 'project-user',
            component: () => import('@/projects/ProjectPage.vue'),
            meta: { auth: 'signedIn', layout: 'shell' },
        };
    }
    // GitHub's sign-in address leads home — the landing page, or the app signed in — keeping where to go after
    // signing in (`next`, GitHub's `return_to`) and why the last sign-in failed.
    yield {
        path: SIGN_IN_PATH,
        redirect: getSignInRedirect,
    };
    // Where GitHub sends the browser back; open to everyone, it finishes the sign-in itself.
    yield {
        path: OAUTH_CALLBACK_PATH,
        name: 'auth-callback',
        component: () => import('@/auth/AuthCallbackPage.vue'),
    };
    // GitHub's own pages githq does not show, and any other address it does not know (a profile, a repository's
    // code), hand off to the same address on github.com — signed out too.
    for (const segment of GITHUB_RESERVED_SEGMENTS) {
        yield {
            path: `/${segment}/:rest(.*)*`,
            name: `github-${segment}`,
            component: () => import('@/shell/GitHubHandOffPage.vue'),
        };
    }
    yield {
        path: '/:path(.*)*',
        name: 'github',
        component: () => import('@/shell/GitHubHandOffPage.vue'),
    };
}

function getSignInRedirect(to: RouteLocation): RouteLocationRaw {
    const query: LocationQueryRaw = {};
    for (const key of ['next', 'return_to', 'failed']) {
        const value = to.query[key];
        if (value !== undefined) {
            query[key] = value;
        }
    }

    return { path: HOME_PATH, query };
}

function getItemPageRedirect(to: RouteLocation, name: string): RouteLocationRaw {
    const { owner, name: repository, number } = to.params;
    return { name, params: { owner, name: repository, number }, query: to.query, hash: to.hash };
}

function getRepositoryPageKey(route: RouteLocation) {
    return `${String(route.params.owner)}/${String(route.params.name)}`;
}
