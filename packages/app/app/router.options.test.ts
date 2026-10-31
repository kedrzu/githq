/// <reference types="bun" />
import { expect, test } from 'bun:test';
import type { RouteLocation } from 'vue-router';
import { createMemoryHistory, createRouter, START_LOCATION } from 'vue-router';

import { ACCOUNT_PATH } from '@/account/accountRoutes.js';
import { TRACKING_CHOICE_PATH, TRACKING_PATH } from '@/auth/routeAccess.js';
import { getItemPagePath } from '@/item/itemRoutes.js';
import { getMyWorkGroupPath } from '@/myWork/myWorkRoutes.js';
import { MY_WORK_GROUPS } from '@/store/ItemStoreTypes.js';
import {
    FIRST_DOWNLOAD_PATH,
    getGitHubUrl,
    getProjectPath,
    getRepositoryKind,
    getRepositoryPath,
    GITHUB_RESERVED_SEGMENTS,
} from '@/tracking/trackingRoutes.js';

import routerOptions from './router.options.js';

// The route table resolved as the app's router resolves it: every GitHub address opens the matching screen, and
// every address githq makes is GitHub's — swap the host and the same thing opens.

const routes = routerOptions.routes();
const router = createRouter({ history: createMemoryHistory(), routes });

/** GitHub addresses and the route each opens. */
const ADDRESSES: readonly (readonly [string, string])[] = [
    ['/', 'my-work'],
    ['/pulls/review-requested', 'my-work-reviewRequested'],
    ['/pulls', 'my-work-authored'],
    ['/issues/assigned', 'my-work-assigned'],
    ['/issues/mentioned', 'my-work-mentioned'],
    ['/pulls/mentioned', 'my-work-mentioned'],
    ['/acme/web', 'repository'],
    ['/acme/web/issues', 'repository'],
    ['/acme/web/pulls', 'repository'],
    ['/my-org/web.js', 'repository'],
    ['/my_org/web-app.v2/pulls', 'repository'],
    // An old githq address is repository-shaped, as on github.com.
    ['/my/assigned', 'repository'],
    ['/acme/web/issues/12', 'item-issue'],
    ['/acme/web/pull/15', 'item-pull'],
    ['/orgs/acme/projects/3', 'project-org'],
    ['/orgs/acme/projects/3/views/2', 'project-org'],
    ['/users/kedrzu/projects/7', 'project-user'],
    ['/settings', 'account'],
    ['/settings/tracking', 'tracking'],
    ['/settings/tracking/new', 'tracking-choice'],
    ['/settings/tracking/download', 'first-download'],
    ['/auth/callback', 'auth-callback'],
    // GitHub's own pages githq does not show.
    ['/orgs/acme', 'github-orgs'],
    ['/orgs/acme/people', 'github-orgs'],
    ['/users/kedrzu', 'github-users'],
    ['/settings/profile', 'github-settings'],
    ['/login/oauth/authorize', 'github-login'],
    ['/issues', 'github-issues'],
    ['/issues/created', 'github-issues'],
    ['/pulls/assigned', 'github-pulls'],
    ['/notifications', 'github-notifications'],
    ['/notifications/subscriptions', 'github-notifications'],
    ['/auth/other', 'github-auth'],
    ['/new', 'github-new'],
    // Any other address githq does not show: a profile, code, a repository's other pages; old githq addresses.
    ['/acme', 'github'],
    ['/acme/web/tree/main', 'github'],
    ['/acme/web.js/tree/main/src', 'github'],
    ['/acme/web/actions', 'github'],
    ['/acme/web/issues/new', 'github'],
    ['/account', 'github-account'],
    ['/sign-in', 'github'],
    ['/tracking', 'github'],
    ['/welcome', 'github'],
    ['/welcome/download', 'repository'],
];

test('every GitHub address opens the matching screen, or hands off to github.com', () => {
    for (const [address, name] of ADDRESSES) {
        expect(router.resolve(address).name, address).toBe(name);
    }
});

test("an item's sub-addresses settle on the item's own, keeping the query and the fragment", () => {
    expect(settle('/acme/web/pull/15/files')).toBe('/acme/web/pull/15');
    expect(settle('/acme/web/pull/15/files?w=1#diff-abc')).toBe('/acme/web/pull/15?w=1#diff-abc');
    expect(settle('/acme/web/pull/15/commits')).toBe('/acme/web/pull/15');
    expect(settle('/acme/web/pull/15/checks?check_run_id=9')).toBe('/acme/web/pull/15?check_run_id=9');
    expect(settle('/acme/web/issues/12/linked_closing_reference?x=1#issuecomment-5')).toBe(
        '/acme/web/issues/12?x=1#issuecomment-5',
    );
    expect(settle('/my-org/web.js/issues/12/a/b/c')).toBe('/my-org/web.js/issues/12');
});

test("GitHub's sign-in address leads home, keeping where to go after signing in and why it last failed", () => {
    expect(settle('/login')).toBe('/');
    expect(settle('/login?next=/pulls')).toBe('/?next=/pulls');
    expect(settle('/login?return_to=https%3A%2F%2Fgithub.com%2Facme')).toBe('/?return_to=https://github.com/acme');
    expect(settle('/login?failed=cancelled&other=1')).toBe('/?failed=cancelled');
    expect(settle('/login?next=/pulls&return_to=/acme&failed=failed')).toBe(
        '/?next=/pulls&return_to=/acme&failed=failed',
    );
});

test('home and every group of "my work" are one page instance', () => {
    const home = routes.filter(route => route.meta?.key === 'my-work');
    expect(home.map(route => route.path)).toEqual([
        '/',
        '/pulls/review-requested',
        '/pulls',
        '/issues/assigned',
        '/issues/mentioned',
    ]);
    for (const route of home) {
        expect(route.component, route.path).toBe(home[0]?.component);
        expect(route.meta?.auth, route.path).toBe('home');
    }

    expect(router.resolve('/pulls/mentioned').meta.key).toBe('my-work');
});

test('the repository page is one instance for the repository and its lists', () => {
    const keyOf = (address: string) => {
        const resolved = router.resolve(address);
        const key = resolved.meta.key;
        return typeof key === 'function' ? key({ ...resolved, name: resolved.name ?? 'unnamed' }) : key;
    };
    expect(keyOf('/acme/web')).toBe('acme/web');
    expect(keyOf('/acme/web/issues')).toBe('acme/web');
    expect(keyOf('/acme/web/pulls')).toBe('acme/web');
    expect(keyOf('/acme/api')).toBe('acme/api');
});

test("a repository's lists are GitHub's addresses of them, and the address names the kind it lists", () => {
    expect(getRepositoryPath('acme/web')).toBe('/acme/web');
    expect(getRepositoryPath('acme/web', 'all')).toBe('/acme/web');
    expect(getRepositoryPath('acme/web', 'issues')).toBe('/acme/web/issues');
    expect(getRepositoryPath('acme/web', 'pullRequests')).toBe('/acme/web/pulls');
    for (const kind of ['all', 'issues', 'pullRequests'] as const) {
        expect(getRepositoryKind(router.resolve(getRepositoryPath('acme/web', kind)).params.kind), kind).toBe(kind);
    }
});

test("every address githq makes is GitHub's: under a parameter or a GitHub-reserved first segment", () => {
    const reserved = new Set<string>(GITHUB_RESERVED_SEGMENTS);
    const isGitHubPath = (path: string) => {
        const first = path.split('/')[1] ?? '';
        return path === '/' || first.startsWith(':') || reserved.has(first);
    };

    for (const route of routes) {
        const alias = route.alias ?? [];
        for (const path of [route.path, ...(typeof alias === 'string' ? [alias] : alias)]) {
            expect(isGitHubPath(path), path).toBe(true);
        }
    }

    // What the builders make opens a screen of githq's, under a route as above.
    const built: readonly (readonly [string, string])[] = [
        ...MY_WORK_GROUPS.map(group => [getMyWorkGroupPath(group), `my-work-${group}`] as const),
        [getRepositoryPath('acme/web'), 'repository'],
        [getRepositoryPath('acme/web', 'issues'), 'repository'],
        [getRepositoryPath('acme/web', 'pullRequests'), 'repository'],
        [getItemPagePath({ owner: 'acme', name: 'web', number: 12 }), 'item-issue'],
        [getItemPagePath({ owner: 'acme', name: 'web', number: 15 }, 'pullRequest'), 'item-pull'],
        [getProjectPath({ owner: 'acme', ownerKind: 'org', number: 3 }), 'project-org'],
        [getProjectPath({ owner: 'kedrzu', ownerKind: 'user', number: 7 }, 2), 'project-user'],
        [ACCOUNT_PATH, 'account'],
        [TRACKING_PATH, 'tracking'],
        [TRACKING_CHOICE_PATH, 'tracking-choice'],
        [FIRST_DOWNLOAD_PATH, 'first-download'],
    ];
    for (const [path, name] of built) {
        const resolved = router.resolve(path);
        expect(resolved.name, path).toBe(name);
        expect(isGitHubPath(resolved.matched.at(-1)?.path ?? ''), path).toBe(true);
    }
});

test('the hand-off always goes to github.com, with the path, query and fragment', () => {
    expect(getGitHubUrl('/acme?tab=repositories#top')).toBe('https://github.com/acme?tab=repositories#top');
    expect(getGitHubUrl('/acme/web/tree/main')).toBe('https://github.com/acme/web/tree/main');
    for (const path of ['//evil.example/x', '/@evil.example', '@evil.example', '.evil.example/x', '/\\evil.example']) {
        expect(new URL(getGitHubUrl(path)).origin, path).toBe('https://github.com');
    }
});

/** Where `address` ends up after its route's redirect, as a full path. */
function settle(address: string) {
    const to = router.resolve(address);
    const record = to.matched.at(-1);
    const redirect = record?.redirect;
    expect(typeof redirect, address).toBe('function');
    const target = typeof redirect === 'function' ? redirect(to satisfies RouteLocation, START_LOCATION) : address;
    return router.resolve(target).fullPath;
}
