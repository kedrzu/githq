import type { LocationQuery, RouteLocationRaw } from 'vue-router';

import { GITHUB_ORIGIN } from '@/tracking/trackingRoutes.js';

import type { SignInFailure } from './AuthStore.js';

/**
 * Who may open a route (`meta.auth` in `app/router.options.ts`); a route without it is open to everyone (the
 * OAuth callback, which runs before anyone is signed in).
 */
export type RouteAuth =
    /** Signed-in users only: the app. */
    | 'signedIn'
    /** Signed out: signing in. A signed-in user goes on to where they were heading. */
    | 'signedOut';

/**
 * A step of the first sign-in (D20): choosing what to track (G2), which a user who made the choice no longer
 * gets, and the first download (G6), which stays open to come back to.
 */
export type FirstSignInStep = 'choose' | 'download';

declare module 'vue-router' {
    interface RouteMeta {
        auth?: RouteAuth;
        /** The route is a step of the first sign-in: a user who has not chosen what to track may open it. */
        firstSignIn?: FirstSignInStep;
    }
}

/** Where signing in is: GitHub's own sign-in address, so no owner's address (`/owner`) is ever taken for it. */
export const SIGN_IN_PATH = '/login';

/** Where a user who has not chosen what to track yet goes first (G2), under GitHub's reserved `/settings`. */
export const TRACKING_CHOICE_PATH = '/settings/tracking/new';

/** Where changing what is tracked is, once chosen (G8), under GitHub's reserved `/settings`. */
export const TRACKING_PATH = '/settings/tracking';

/** The session, as far as the guard looks at it (`AuthStore`). */
export interface GuardedSession {
    readonly signedIn: boolean;
    /** Why the session ended, carried to sign-in so it can say so — after a reload too. */
    readonly failure: SignInFailure | null;
    /**
     * The signed-in user chose what to track (G2) — in this browser's copy of their data. Signing in again later
     * finds it there and goes straight to their work.
     */
    readonly trackingChosen: boolean;
}

/** The route being opened, as far as the guard looks at it. */
export interface GuardedRoute {
    readonly fullPath: string;
    readonly query: LocationQuery;
    readonly meta: { readonly auth?: RouteAuth; readonly firstSignIn?: FirstSignInStep };
}

/**
 * Where to send the user instead of `to`, or `undefined` to let them in:
 *
 * - signed out, to a route for signed-in users → sign-in, with `next` to come back to and `failed` when the
 *   session ended for a reason (a token GitHub rejected);
 * - signed in, to sign-in → `next` or GitHub's `return_to` (or "My work"), see {@link readSignInReturnPath};
 * - signed in without having chosen what to track, to the app → choosing it (G2), with `next` to go on to after
 *   (none for "My work", where it goes anyway);
 * - signed in having chosen, to choosing (G2) → changing what is tracked (G8).
 */
export function resolveRouteAccess(to: GuardedRoute, session: GuardedSession): RouteLocationRaw | undefined {
    switch (to.meta.auth) {
        case 'signedOut':
            return session.signedIn ? (readSignInReturnPath(to.query) ?? '/') : undefined;
        case 'signedIn': {
            if (!session.signedIn) {
                const next = to.fullPath;
                return { path: SIGN_IN_PATH, query: session.failure ? { next, failed: session.failure } : { next } };
            }

            if (session.trackingChosen) {
                return to.meta.firstSignIn === 'choose' ? TRACKING_PATH : undefined;
            }

            if (to.meta.firstSignIn) {
                return undefined;
            }

            return { path: TRACKING_CHOICE_PATH, query: to.fullPath === '/' ? {} : { next: to.fullPath } };
        }
        default:
            return undefined;
    }
}

/**
 * The `failed` of a sign-in link (`/login?failed=…`) when it is a reason the sign-in page explains; anything
 * else — a hand-edited link — shows no notice.
 * @__NO_SIDE_EFFECTS__
 */
export function readSignInFailure(failed: LocationQuery[string] | undefined): SignInFailure | null {
    const value = Array.isArray(failed) ? failed[0] : failed;
    switch (value) {
        case 'cancelled':
        case 'failed':
        case 'missingScopes':
        case 'tokenRejected':
            return value;
        default:
            return null;
    }
}

/**
 * Where a sign-in link (`/login?next=…`) goes once signed in: its `next`, or else GitHub's `return_to` — which
 * GitHub's own sign-in links carry, as a path or a full `https://github.com/…` address, whose path, query and
 * fragment are taken, as the same address opens the same thing here. Never another site; `undefined` when
 * neither says where to go.
 * @__NO_SIDE_EFFECTS__
 */
export function readSignInReturnPath(query: LocationQuery): string | undefined {
    return safeNextPath(query.next) ?? safeReturnToPath(query.return_to);
}

function safeReturnToPath(returnTo: LocationQuery[string] | undefined): string | undefined {
    const value = Array.isArray(returnTo) ? returnTo[0] : returnTo;
    // Up to the slash after the host nothing else can name a host (`https://github.com@evil.example`,
    // `https://github.com.evil.example` do not start so); what follows goes through the same check as `next`.
    if (typeof value === 'string' && value.startsWith(`${GITHUB_ORIGIN}/`)) {
        return safeNextPath(value.slice(GITHUB_ORIGIN.length));
    }

    return safeNextPath(value);
}

/**
 * The `next` of a sign-in link when it is a path of this app — never another site (`//evil.example`,
 * `https://…`), so a crafted link cannot send a freshly signed-in user away.
 * @__NO_SIDE_EFFECTS__
 */
export function safeNextPath(next: LocationQuery[string] | undefined): string | undefined {
    const value = Array.isArray(next) ? next[0] : next;
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
        return undefined;
    }

    return value;
}
