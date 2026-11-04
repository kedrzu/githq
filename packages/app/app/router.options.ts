import type { RouterConfig } from 'nuxt/schema';
import type { LocationQueryRaw, RouteLocation, RouteLocationRaw, RouteRecordRaw } from 'vue-router';
import { stringifyQuery } from 'vue-router';

import { OAUTH_CALLBACK_PATH } from '@githq/github/oauth.js';

import { HOME_PATH, SIGN_IN_PATH, TRACKING_CHOICE_PATH } from '@/auth/routeAccess.js';
import HomePage from '@/home/HomePage.vue';
import { ITEM_PAGE_PATHS, REVIEW_PAGE_ALIAS, REVIEW_PAGE_PATH } from '@/item/itemRoutes.js';
import { MY_WORK_GROUP_PATHS } from '@/myWork/myWorkRoutes.js';
import { SETTINGS_PATH } from '@/settings/settingsRoutes.js';
import { MY_WORK_GROUPS } from '@/store/ItemStoreTypes.js';
import {
    BROKEN_WORKFLOWS_PATH,
    FIRST_DOWNLOAD_PATH,
    GITHUB_RESERVED_SEGMENTS,
    PROJECT_PATHS,
    PROJECT_SETTINGS_PATHS,
    REPOSITORY_PATH,
    REPOSITORY_SETTINGS_PATH,
    WORKFLOW_RUN_JOB_PATH,
    WORKFLOW_RUN_PATH,
    getRouteNameWithOwner,
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

function* getRoutes(): Generator<RouteRecordRaw> {
    // Home: "My work", and narrowed to one of its groups at GitHub's dashboard address of that list —
    // `/pulls/mentioned` too, for the mentioned group holds pull requests as well; one page instance for all (`key`).
    // Signed out, `/` is the landing page (the desktop app's sign-in in its build, `home/HomePage.vue`). The guard sets the layout (`middleware/auth.global.ts`): the shell
    // signed in, none for the landing page — which is also what the server renders. One component for every home
    // route, so moving between them keeps the page (`key: 'my-work'`). Not a chunk of its own: it only picks the
    // page, and each page is one (`home/HomePage.vue`), so the shell goes straight to "my work"'s chunk.
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
    // A pull request's review, at GitHub's address of its changed files: before the addresses that settle on the item.
    yield {
        path: REVIEW_PAGE_PATH,
        alias: REVIEW_PAGE_ALIAS,
        name: 'review',
        component: () => import('@/review/ReviewPage.vue'),
        meta: { auth: 'signedIn', layout: 'shell', key: 'review', railForced: true },
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
        // GitHub's other addresses under an item (a pull request's `/commits`, `/checks`, …) settle on the
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
    // Settings, one screen (D15), its section in `?tab=`. The address tracking used to have settles on it, so an
    // old link never hands off to github.com.
    yield {
        path: SETTINGS_PATH,
        name: 'settings',
        component: () => import('@/settings/SettingsPage.vue'),
        meta: { auth: 'signedIn', layout: 'shell' },
    };
    yield {
        path: `${SETTINGS_PATH}/tracking`,
        redirect: to => ({ path: SETTINGS_PATH, query: to.query, hash: to.hash }),
    };
    // The broken workflows of every tracked repository (actions W2). A static path under GitHub's reserved
    // `/dashboard`, which outranks that segment's hand-off to github.com.
    yield {
        path: BROKEN_WORKFLOWS_PATH,
        name: 'workflows',
        component: () => import('@/workflows/BrokenWorkflowsPage.vue'),
        meta: { auth: 'signedIn', layout: 'shell' },
    };
    // A workflow's run, at GitHub's addresses of it and of its jobs; one page instance for both (`key`), so moving
    // between the jobs keeps the page. Static segments outrank the repository's other pages' hand-off to github.com.
    for (const [name, path] of [
        ['workflow-run', WORKFLOW_RUN_PATH],
        ['workflow-run-job', WORKFLOW_RUN_JOB_PATH],
    ] as const) {
        yield {
            path,
            name,
            component: () => import('@/workflows/WorkflowRunPage.vue'),
            meta: { auth: 'signedIn', layout: 'shell', key: getWorkflowRunKey },
        };
    }
    // A repository's and a project's views, at GitHub's addresses of them. One repository page instance for the
    // repository and its lists of issues and pull requests (`key`), so switching between them keeps the screen.
    yield {
        path: REPOSITORY_PATH,
        name: 'repository',
        component: () => import('@/repository/RepositoryPage.vue'),
        meta: { auth: 'signedIn', layout: 'shell', key: getRouteNameWithOwner },
    };
    for (const [index, path] of PROJECT_PATHS.entries()) {
        yield {
            path,
            name: index === 0 ? 'project-org' : 'project-user',
            component: () => import('@/projects/ProjectPage.vue'),
            meta: { auth: 'signedIn', layout: 'shell' },
        };
    }
    // A tracked repository's and project's settings (T16, T17), inside Settings, at GitHub's own addresses of their
    // settings — so the same address opens them on github.com. The static last segment outranks the hand-off of a
    // repository's other pages (`/owner/name/:path`) and of `/orgs/…`, `/users/…`; one not tracked settles on its
    // section of Settings (the page does, once the kept settings are read).
    yield {
        path: REPOSITORY_SETTINGS_PATH,
        name: 'repository-settings',
        component: () => import('@/settings/RepositorySettingsPage.vue'),
        meta: { auth: 'signedIn', layout: 'shell' },
    };
    for (const [index, path] of PROJECT_SETTINGS_PATHS.entries()) {
        yield {
            path,
            name: index === 0 ? 'project-org-settings' : 'project-user-settings',
            component: () => import('@/settings/ProjectSettingsPage.vue'),
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

function getWorkflowRunKey(to: RouteLocation) {
    return `workflow-run:${getRouteNameWithOwner(to)}:${String(to.params.run)}`;
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
