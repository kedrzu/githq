/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { SignInFailure } from './AuthStore.js';
import type { FirstSignInStep, GuardedRoute, GuardedSession, RouteAuth } from './routeAccess.js';
import { readSignInFailure, readSignInReturnPath, resolveRouteAccess, safeNextPath } from './routeAccess.js';

const SIGNED_IN: GuardedSession = { signedIn: true, failure: null, trackingChosen: true };
const SIGNED_OUT: GuardedSession = { signedIn: false, failure: null, trackingChosen: false };
const FIRST_SIGN_IN: GuardedSession = { signedIn: true, failure: null, trackingChosen: false };

test('signed out, an app route sends to sign-in with the way back', () => {
    expect(resolveRouteAccess(route('/', 'signedIn'), SIGNED_OUT)).toEqual({ path: '/login', query: { next: '/' } });
    expect(resolveRouteAccess(route('/pulls/review-requested?x=1', 'signedIn', { x: '1' }), SIGNED_OUT)).toEqual({
        path: '/login',
        query: { next: '/pulls/review-requested?x=1' },
    });
    expect(resolveRouteAccess(route('/', 'signedIn'), SIGNED_IN)).toBeUndefined();
});

test('a session that ended for a reason carries it to sign-in, next to the way back', () => {
    expect(
        resolveRouteAccess(route('/', 'signedIn'), {
            signedIn: false,
            failure: 'tokenRejected',
            trackingChosen: false,
        }),
    ).toEqual({
        path: '/login',
        query: { next: '/', failed: 'tokenRejected' },
    });
});

test('sign-in explains only the reasons it knows', () => {
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

test('signed in, sign-in goes on to `next`, or to the app; signed out it opens', () => {
    expect(resolveRouteAccess(route('/login', 'signedOut'), SIGNED_OUT)).toBeUndefined();
    expect(
        resolveRouteAccess(
            route('/login?next=/pulls/review-requested', 'signedOut', { next: '/pulls/review-requested' }),
            SIGNED_IN,
        ),
    ).toBe('/pulls/review-requested');
    expect(resolveRouteAccess(route('/login', 'signedOut'), SIGNED_IN)).toBe('/');
    expect(
        resolveRouteAccess(route('/login?next=//evil.example', 'signedOut', { next: '//evil.example' }), SIGNED_IN),
    ).toBe('/');
});

test("signed in, sign-in goes on to GitHub's `return_to` too — a path, or a github.com address's path", () => {
    expect(
        resolveRouteAccess(
            route('/login', 'signedOut', { return_to: 'https://github.com/acme/web/pull/15/files?w=1#diff' }),
            SIGNED_IN,
        ),
    ).toBe('/acme/web/pull/15/files?w=1#diff');
    expect(resolveRouteAccess(route('/login', 'signedOut', { return_to: '/acme/web' }), SIGNED_IN)).toBe('/acme/web');
    expect(
        resolveRouteAccess(route('/login', 'signedOut', { next: '/pulls', return_to: '/acme/web' }), SIGNED_IN),
    ).toBe('/pulls');
    expect(resolveRouteAccess(route('/login', 'signedOut', { return_to: 'https://evil.example/x' }), SIGNED_IN)).toBe(
        '/',
    );
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
    expect(resolveRouteAccess(route('/', 'signedIn'), FIRST_SIGN_IN)).toEqual({
        path: '/settings/tracking/new',
        query: {},
    });
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
    expect(resolveRouteAccess(route('/', 'signedIn'), SIGNED_IN)).toBeUndefined();
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
    return { fullPath, query, meta: auth ? { auth, firstSignIn } : {} };
}
