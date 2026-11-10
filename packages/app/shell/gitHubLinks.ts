import type { RouteLocation } from 'vue-router';

import { getOpenedItemRoute } from '@/item/itemRoutes.js';
import type { ItemReference } from '@/item/itemRoutes.js';
import { getRouteNameWithOwner, isTrackedOnlyRoute } from '@/tracking/trackingRoutes.js';

/** The hosts whose addresses can be githq's; `http` and `https` alike. */
const GITHUB_HOSTNAMES: readonly string[] = ['github.com', 'www.github.com'];

/** The schemes of an address that can be githq's. */
const GITHUB_PROTOCOLS: readonly string[] = ['https:', 'http:'];

/** What {@link getGitHubLinkTarget} reads of the router: the resolver, which is also a memory router's. */
export interface GitHubLinkRouter {
    resolve(path: string): Pick<RouteLocation, 'meta' | 'name' | 'params' | 'query'>;
}

/** What {@link getGitHubLinkTarget} needs to know. */
export interface GetGitHubLinkTargetParams {
    readonly router: GitHubLinkRouter;
    /** Whether the repository (`owner/name`) is tracked: only a tracked repository has workflows. */
    readonly isTracked: (nameWithOwner: string) => boolean;
}

/** Where a link to github.com opens in githq. */
export interface GitHubLinkTarget {
    /** The app's path, query and fragment: the link's own, on the app's host. */
    readonly path: string;
    /** The item, when the address is an item's (a sub-page of it too); `null` for the rest, the review included. */
    readonly item: ItemReference | null;
}

/**
 * Where an address opens in githq, or `null` when it stays GitHub's. Only an `http(s)` address on `github.com`
 * (`www.` too) without a port or credentials can be githq's; of those, one for which githq has the same screen
 * (`meta.gitHubScreen`), a Workflows page or a run only for a tracked repository. An address githq hands off, or its
 * own page (settings, sign-in, download), is GitHub's, and so is anything that does not parse.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getGitHubLinkTarget(url: string, params: GetGitHubLinkTargetParams): GitHubLinkTarget | null {
    const { router, isTracked } = params;
    const parsed = parseUrl(url);
    if (
        parsed === null ||
        !GITHUB_PROTOCOLS.includes(parsed.protocol) ||
        !GITHUB_HOSTNAMES.includes(parsed.hostname) ||
        parsed.port !== '' ||
        parsed.username !== '' ||
        parsed.password !== '' ||
        // `//host` as a path would be read as a host once the path is taken for an address.
        parsed.pathname.startsWith('//')
    ) {
        return null;
    }

    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    const route = router.resolve(path);
    if (!route.meta.gitHubScreen || (isTrackedOnlyRoute(route) && !isTracked(getRouteNameWithOwner(route)))) {
        return null;
    }

    const opened = getOpenedItemRoute(route);
    return { path, item: opened?.onPage ? opened.reference : null };
}

function parseUrl(url: string) {
    try {
        return new URL(url);
    } catch {
        return null;
    }
}
