/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { SignInFailure } from './AuthStore.js';
import type { FirstSignInStep, GuardedRoute, GuardedSession, RouteAuth } from './routeAccess.js';
import { readSignInFailure, readSignInReturnPath, resolveRouteAccess, safeNextPath } from './routeAccess.js';

const SIGNED_IN: GuardedSession = { signedIn: true, failure: null, trackingChosen: true };
const SIGNED_OUT: GuardedSession = { signedIn: false, failure: null, trackingChosen: false };
const FIRST_SIGN_IN: GuardedSession = { signedIn: true, failure: null, trackingChosen: false };
const TOKEN_REJECTED: GuardedSession = { signedIn: false, failure: 'tokenRejected', trackingChosen: false };

test('signed out, an app route sends to the landing page with the way back', () => {
    expect(resolveRouteAccess(route('/settings', 'signedIn'), SIGNED_OUT)).toEqual({
        path: '/',
        query: { next: '/settings' },
    });
    expect(resolveRouteAccess(route('/pulls/review-requested?x=1', 'home', { x: '1' }), SIGNED_OUT)).toEqual({
        path: '/',
        query: { next: '/pulls/review-requested?x=1' },
    });
    expect(resolveRouteAccess(route('/settings', 'signedIn'), SIGNED_IN)).toBeUndefined();
});

test('signed out, home is the landing page, whatever its address carries — never sent on, so never a loop', () => {
    expect(resolveRouteAccess(route('/', 'home'), SIGNED_OUT)).toBeUndefined();
    expect(resolveRouteAccess(route('/?next=/pulls', 'home', { next: '/pulls' }), SIGNED_OUT)).toBeUndefined();
    expect(
        resolveRouteAccess(route('/?return_to=/acme/web', 'home', { return_to: '/acme/web' }), SIGNED_OUT),
    ).toBeUndefined();
    expect(
        resolveRouteAccess(route('/?failed=cancelled', 'home', { failed: 'cancelled' }), SIGNED_OUT),
    ).toBeUndefined();
    // Where it sends a signed-out visitor from the app is the landing page itself.
    const sent = resolveRouteAccess(route('/acme/web', 'signedIn'), SIGNED_OUT);
    expect(sent).toEqual({ path: '/', query: { next: '/acme/web' } });
    expect(resolveRouteAccess(route('/?next=/acme/web', 'home', { next: '/acme/web' }), SIGNED_OUT)).toBeUndefined();
});

test('a session that ended for a reason carries it to the landing page, next to the way back', () => {
    expect(resolveRouteAccess(route('/acme/web', 'signedIn'), TOKEN_REJECTED)).toEqual({
        path: '/',
        query: { next: '/acme/web', failed: 'tokenRejected' },
    });
    expect(resolveRouteAccess(route('/pulls', 'home'), TOKEN_REJECTED)).toEqual({
        path: '/',
        query: { next: '/pulls', failed: 'tokenRejected' },
    });
    // Ended at home itself: the reason goes into its address, once.
    expect(resolveRouteAccess(route('/', 'home'), TOKEN_REJECTED)).toEqual({
        path: '/',
        query: { failed: 'tokenRejected' },
    });
    expect(resolveRouteAccess(route('/?next=/pulls', 'home', { next: '/pulls' }), TOKEN_REJECTED)).toEqual({
        path: '/',
        query: { next: '/pulls', failed: 'tokenRejected' },
    });
    expect(
        resolveRouteAccess(route('/?failed=tokenRejected', 'home', { failed: 'tokenRejected' }), TOKEN_REJECTED),
    ).toBeUndefined();
    expect(resolveRouteAccess(route('/?failed=x', 'home', { failed: 'x' }), TOKEN_REJECTED)).toEqual({
        path: '/',
        query: { failed: 'tokenRejected' },
    });
});

test('the landing page explains only the reasons it knows', () => {
    const reasons: SignInFailure[] = ['cancelled', 'failed', 'missingScopes', 'tokenRejected'];
    for (const reason of reasons) {
        expect(readSignInFailure(reason)).toBe(reason);
    }

    expect(readSignInFailure(['missingScopes', 'failed'])).toBe('missingScopes');
    expect(readSignInFailure('somethingElse')).toBeNull();
    expect(readSignInFailure('')).toBeNull();
    expect(readSignInFailure(null)).toBeNull();
    expect(readSignInFailure(undefined)).toBeNull();
});

test('signed in, home goes on to `next`, or opens "my work"; never off-site', () => {
    expect(
        resolveRouteAccess(
            route('/?next=/pulls/review-requested', 'home', { next: '/pulls/review-requested' }),
            SIGNED_IN,
        ),
    ).toBe('/pulls/review-requested');
    expect(resolveRouteAccess(route('/', 'home'), SIGNED_IN)).toBeUndefined();
    expect(resolveRouteAccess(route('/?failed=cancelled', 'home', { failed: 'cancelled' }), SIGNED_IN)).toBeUndefined();
    expect(
        resolveRouteAccess(route('/?next=//evil.example', 'home', { next: '//evil.example' }), SIGNED_IN),
    ).toBeUndefined();
    expect(
        resolveRouteAccess(route('/?next=https://evil.example', 'home', { next: 'https://evil.example' }), SIGNED_IN),
    ).toBeUndefined();
    // A group of "my work" is not a sign-in link: its `next` is not followed.
    expect(
        resolveRouteAccess(route('/pulls?next=/acme/web', 'home', { next: '/acme/web' }), SIGNED_IN),
    ).toBeUndefined();
});

test("signed in, home goes on to GitHub's `return_to` too — a path, or a github.com address's path", () => {
    expect(
        resolveRouteAccess(
            route('/', 'home', { return_to: 'https://github.com/acme/web/pull/15/files?w=1#diff' }),
            SIGNED_IN,
        ),
    ).toBe('/acme/web/pull/15/files?w=1#diff');
    expect(resolveRouteAccess(route('/', 'home', { return_to: '/acme/web' }), SIGNED_IN)).toBe('/acme/web');
    expect(resolveRouteAccess(route('/', 'home', { next: '/pulls', return_to: '/acme/web' }), SIGNED_IN)).toBe(
        '/pulls',
    );
    expect(resolveRouteAccess(route('/', 'home', { return_to: 'https://evil.example/x' }), SIGNED_IN)).toBeUndefined();
});

test('`return_to` never leads off-site', () => {
    expect(readSignInReturnPath({ return_to: 'https://github.com/' })).toBe('/');
    expect(readSignInReturnPath({ return_to: ['https://github.com/acme', '/x'] })).toBe('/acme');
    expect(readSignInReturnPath({ return_to: 'https://github.com.evil.example/x' })).toBeUndefined();
    expect(readSignInReturnPath({ return_to: 'https://github.com@evil.example/x' })).toBeUndefined();
    expect(readSignInReturnPath({ return_to: 'https://github.com//evil.example/x' })).toBeUndefined();
    expect(readSignInReturnPath({ return_to: 'https://github.com/\\evil.example/x' })).toBeUndefined();
    expect(readSignInReturnPath({ return_to: 'http://github.com/acme' })).toBeUndefined();
    expect(readSignInReturnPath({ return_to: 'https://evil.example/acme' })).toBeUndefined();
    expect(readSignInReturnPath({ return_to: '//evil.example/x' })).toBeUndefined();
    expect(readSignInReturnPath({ return_to: '/\\evil.example' })).toBeUndefined();
    expect(readSignInReturnPath({ return_to: 'javascript:alert(1)' })).toBeUndefined();
    expect(readSignInReturnPath({ return_to: null })).toBeUndefined();
    expect(readSignInReturnPath({})).toBeUndefined();
    // An off-site `next` is not taken, and `return_to` is read instead.
    expect(readSignInReturnPath({ next: '//evil.example', return_to: '/acme' })).toBe('/acme');
});

test('a first sign-in chooses what to track before anything else, then goes on to where it was heading', () => {
    expect(resolveRouteAccess(route('/', 'home'), FIRST_SIGN_IN)).toEqual({
        path: '/settings/tracking/new',
        query: {},
    });
    expect(resolveRouteAccess(route('/pulls', 'home'), FIRST_SIGN_IN)).toEqual({
        path: '/settings/tracking/new',
        query: { next: '/pulls' },
    });
    // Signed in from a sign-in link, the link's `next` first; choosing what to track comes on the way there.
    expect(resolveRouteAccess(route('/?next=/pulls', 'home', { next: '/pulls' }), FIRST_SIGN_IN)).toBe('/pulls');
    expect(resolveRouteAccess(route('/acme/api/issues/3', 'signedIn'), FIRST_SIGN_IN)).toEqual({
        path: '/settings/tracking/new',
        query: { next: '/acme/api/issues/3' },
    });
    expect(
        resolveRouteAccess(route('/settings/tracking/new', 'signedIn', {}, 'choose'), FIRST_SIGN_IN),
    ).toBeUndefined();
    expect(
        resolveRouteAccess(route('/settings/tracking/download', 'signedIn', {}, 'download'), FIRST_SIGN_IN),
    ).toBeUndefined();
});

test('signed in again with the choice kept, the app opens straight away; choosing again is the tracking page', () => {
    expect(resolveRouteAccess(route('/', 'home'), SIGNED_IN)).toBeUndefined();
    expect(resolveRouteAccess(route('/settings/tracking/new', 'signedIn', {}, 'choose'), SIGNED_IN)).toBe(
        '/settings/tracking',
    );
    expect(
        resolveRouteAccess(route('/settings/tracking/download', 'signedIn', {}, 'download'), SIGNED_IN),
    ).toBeUndefined();
});

test('a route without access rules opens to everyone', () => {
    expect(resolveRouteAccess(route('/auth/callback'), SIGNED_OUT)).toBeUndefined();
    expect(resolveRouteAccess(route('/auth/callback'), SIGNED_IN)).toBeUndefined();
});

test('`next` is only ever a path of this app', () => {
    expect(safeNextPath('/pulls/review-requested?x=1')).toBe('/pulls/review-requested?x=1');
    expect(safeNextPath(['/pulls/review-requested', '/'])).toBe('/pulls/review-requested');
    expect(safeNextPath('//evil.example/x')).toBeUndefined();
    expect(safeNextPath('/\\evil.example')).toBeUndefined();
    expect(safeNextPath('https://evil.example')).toBeUndefined();
    expect(safeNextPath('review')).toBeUndefined();
    expect(safeNextPath(null)).toBeUndefined();
    expect(safeNextPath(undefined)).toBeUndefined();
});

function route(
    fullPath: string,
    auth?: RouteAuth,
    query: GuardedRoute['query'] = {},
    firstSignIn?: FirstSignInStep,
): GuardedRoute {
    const path = fullPath.split('?')[0] ?? fullPath;
    return { path, fullPath, query, meta: auth ? { auth, firstSignIn } : {} };
}
