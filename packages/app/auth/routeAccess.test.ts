/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { SignInFailure } from './AuthStore.js';
import type { FirstSignInStep, GuardedRoute, GuardedSession, RouteAuth } from './routeAccess.js';
import { readSignInFailure, resolveRouteAccess, safeNextPath } from './routeAccess.js';

const SIGNED_IN: GuardedSession = { signedIn: true, failure: null, trackingChosen: true };
const SIGNED_OUT: GuardedSession = { signedIn: false, failure: null, trackingChosen: false };
const FIRST_SIGN_IN: GuardedSession = { signedIn: true, failure: null, trackingChosen: false };

test('signed out, an app route sends to sign-in with the way back', () => {
    expect(resolveRouteAccess(route('/', 'signedIn'), SIGNED_OUT)).toEqual({ path: '/sign-in', query: { next: '/' } });
    expect(resolveRouteAccess(route('/review?x=1', 'signedIn', { x: '1' }), SIGNED_OUT)).toEqual({
        path: '/sign-in',
        query: { next: '/review?x=1' },
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
        path: '/sign-in',
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
    expect(resolveRouteAccess(route('/sign-in', 'signedOut'), SIGNED_OUT)).toBeUndefined();
    expect(resolveRouteAccess(route('/sign-in?next=/review', 'signedOut', { next: '/review' }), SIGNED_IN)).toBe(
        '/review',
    );
    expect(resolveRouteAccess(route('/sign-in', 'signedOut'), SIGNED_IN)).toBe('/');
    expect(
        resolveRouteAccess(route('/sign-in?next=//evil.example', 'signedOut', { next: '//evil.example' }), SIGNED_IN),
    ).toBe('/');
});

test('a first sign-in chooses what to track before anything else, then goes on to where it was heading', () => {
    expect(resolveRouteAccess(route('/', 'signedIn'), FIRST_SIGN_IN)).toEqual({ path: '/welcome', query: {} });
    expect(resolveRouteAccess(route('/acme/api/issues/3', 'signedIn'), FIRST_SIGN_IN)).toEqual({
        path: '/welcome',
        query: { next: '/acme/api/issues/3' },
    });
    expect(resolveRouteAccess(route('/welcome', 'signedIn', {}, 'choose'), FIRST_SIGN_IN)).toBeUndefined();
    expect(resolveRouteAccess(route('/welcome/download', 'signedIn', {}, 'download'), FIRST_SIGN_IN)).toBeUndefined();
});

test('signed in again with the choice kept, the app opens straight away; choosing again is the tracking page', () => {
    expect(resolveRouteAccess(route('/', 'signedIn'), SIGNED_IN)).toBeUndefined();
    expect(resolveRouteAccess(route('/welcome', 'signedIn', {}, 'choose'), SIGNED_IN)).toBe('/tracking');
    expect(resolveRouteAccess(route('/welcome/download', 'signedIn', {}, 'download'), SIGNED_IN)).toBeUndefined();
});

test('a route without access rules opens to everyone', () => {
    expect(resolveRouteAccess(route('/auth/callback'), SIGNED_OUT)).toBeUndefined();
    expect(resolveRouteAccess(route('/auth/callback'), SIGNED_IN)).toBeUndefined();
});

test('`next` is only ever a path of this app', () => {
    expect(safeNextPath('/review?x=1')).toBe('/review?x=1');
    expect(safeNextPath(['/review', '/'])).toBe('/review');
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
