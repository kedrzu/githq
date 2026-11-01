import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import {
    hasOAuthScopes,
    OAUTH_AUTHORIZE_PATH,
    OAUTH_CALLBACK_PATH,
    OAUTH_TOKEN_PATH,
    SIGNED_IN_HINT_COOKIE,
} from '@githq/github/oauth.js';
import type { OAuthTokenExchangeResult } from '@githq/github/oauth.js';
import { parseJson } from '@githq/github/utils/parseJson.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { shallowRef, watch } from 'vue';

import { Browser } from '@/services/Browser.js';
import { GitHubSdkFactory } from '@/services/GitHubSdkFactory.js';

import { safeNextPath } from './routeAccess.js';
import { TokenVault } from './TokenVault.js';

/** The signed-in GitHub user, as the shell shows them. */
export interface Viewer {
    readonly login: string;
    readonly name: string | null;
    readonly avatarUrl: string;
}

/**
 * Why the user is on the landing page again, which its banner explains:
 *
 * - `cancelled`: they declined on GitHub's consent screen;
 * - `failed`: anything else on the way back — a `state` that is not ours, a code GitHub refused, the network;
 * - `missingScopes`: they narrowed the scopes githq asked for (D3), so it could not work;
 * - `tokenRejected`: GitHub stopped accepting the stored token (revoked, expired), so they were signed out.
 */
export type SignInFailure = 'cancelled' | 'failed' | 'missingScopes' | 'tokenRejected';

/** The query GitHub sends the browser back to `/auth/callback` with. */
export interface SignInCallbackParams {
    readonly code?: string;
    readonly state?: string;
    /** `access_denied` when the user cancelled. */
    readonly error?: string;
}

/** How a sign-in ended: where to go on, or why it failed (also kept in `failure`). */
export type SignInResult =
    | { readonly ok: true; readonly returnTo: string }
    | { readonly ok: false; readonly failure: SignInFailure };

/** The signed-in user, kept so a reload shows the shell at once; refreshed in the background. */
export const VIEWER_KEY = 'githq.viewer';
/** The sign-in under way (`sessionStorage`): its `state` and where to return, while the user is on GitHub. */
export const PENDING_SIGN_IN_KEY = 'githq.signIn';

interface PendingSignIn {
    state: string;
    returnTo: string;
}

/**
 * The GitHub session: the OAuth token and who it belongs to, signing in through GitHub's web flow (D1) and
 * signing out.
 *
 * The token is kept in the {@link TokenVault} and the user in `localStorage`, so a reload opens the shell straight
 * away; the user is then read again from GitHub in the background, and a token GitHub rejects (401) signs the user
 * out with `failure: 'tokenRejected'`. The token is never logged.
 *
 * While a token is stored, the `githq_signed_in` cookie ({@link SIGNED_IN_HINT_COOKIE}) is set, so the Worker serves
 * the app rather than the landing page at `/`; it is cleared with the token. It carries no token and no identity.
 *
 * Every tab of the app shares the session: signing out in one signs out the others, and signing in as someone
 * else in one moves the others to that user.
 */
export type AuthStore = Resolved<typeof AuthStore>;
export const AuthStore = defineService({
    name: 'AuthStore',
    deps: {
        browser: Browser,
        createSdk: GitHubSdkFactory,
        logger: Logger,
        vault: TokenVault,
    },
    setup({ browser, createSdk, logger, vault }) {
        const tokenRef = shallowRef<string | null>(vault.read());
        const viewerRef = shallowRef<Viewer | null>(tokenRef.value === null ? null : readStoredViewer());
        const failureRef = shallowRef<SignInFailure | null>(null);

        // With a known user the shell opens at once and the check runs behind it; without one, the route guard
        // waits for it.
        const ready = tokenRef.value !== null && viewerRef.value === null ? refreshViewer() : Promise.resolve();
        if (tokenRef.value !== null && viewerRef.value !== null) {
            void refreshViewer();
        }

        // Follows the token, not `signedIn`: the cookie must not blink while a stored token's user is fetched. Every
        // change of the token goes through `tokenRef`, so this is the only place that writes the cookie.
        watch(tokenRef, token => browser.writeCookie(signedInHintCookie(token !== null)), {
            immediate: true,
            flush: 'sync',
        });

        vault.onChange(followStoredToken);

        return {
            /** Whether a user is signed in; reactive. */
            get signedIn() {
                return tokenRef.value !== null && viewerRef.value !== null;
            },
            /** The signed-in user, or `null`; reactive. */
            get viewer() {
                return viewerRef.value;
            },
            /** The OAuth token for GitHub's API, or `null` signed out. */
            get token() {
                return tokenRef.value;
            },
            /** Why the last sign-in failed or the session ended, for the landing page's banner; reactive. */
            get failure() {
                return failureRef.value;
            },
            /** Resolves once the stored session is known to belong to a user (or is gone). */
            ready: () => ready,
            startSignIn,
            completeSignIn,
            signInWithToken,
            signOut,
            dismissFailure,
            refreshViewer,
        };

        /**
         * Leaves for GitHub's consent screen through the Worker. A fresh random `state` is kept in this tab's
         * `sessionStorage`, with `returnTo` (a path of the app), for {@link completeSignIn} to check.
         */
        function startSignIn(returnTo: string) {
            const pending: PendingSignIn = { state: createState(), returnTo };
            browser.sessionStorage.setItem(PENDING_SIGN_IN_KEY, JSON.stringify(pending));
            failureRef.value = null;
            browser.navigate(`${OAUTH_AUTHORIZE_PATH}?state=${pending.state}`);
        }

        /**
         * Finishes a sign-in GitHub sent back to `/auth/callback`. The `state` must be the one this tab kept
         * before leaving — anything else (none kept, none sent, another one) fails without exchanging the code.
         * Then the Worker trades the code for a token, the granted scopes are checked, and the token is kept
         * only once GitHub has said whose it is.
         */
        async function completeSignIn(params: SignInCallbackParams): Promise<SignInResult> {
            const pending = takePendingSignIn();
            if (!pending || params.state === undefined || params.state !== pending.state) {
                logger.warn('Sign-in callback with a state this tab did not issue');
                return fail('failed');
            }

            if (params.error !== undefined) {
                return fail(params.error === 'access_denied' ? 'cancelled' : 'failed');
            }

            if (params.code === undefined || params.code === '') {
                return fail('failed');
            }

            const exchanged = await exchangeCode(params.code);
            if (!exchanged) {
                return fail('failed');
            }

            if (!hasOAuthScopes(exchanged.scopes)) {
                return fail('missingScopes');
            }

            return await acceptToken(exchanged.accessToken, pending.returnTo);
        }

        /**
         * Signs in with a token from elsewhere — the development sign-in's pasted one (`DevTokenForm`), or the one
         * the desktop app's device sign-in got (`DeviceSignIn`). Kept once GitHub has said whose it is, unless
         * `signal` aborted meanwhile: then it rejects with the abort reason and keeps nothing.
         */
        async function signInWithToken(token: string, signal?: AbortSignal): Promise<SignInResult> {
            return await acceptToken(token, '/', signal);
        }

        /** Forgets the token and the user. With a `failure`, the landing page explains it. */
        function signOut(failure: SignInFailure | null = null) {
            vault.remove();
            browser.localStorage.removeItem(VIEWER_KEY);
            tokenRef.value = null;
            viewerRef.value = null;
            failureRef.value = failure;
        }

        /** The user dismissed the explanation of `failure`: the route guard no longer brings it back. */
        function dismissFailure() {
            failureRef.value = null;
        }

        /**
         * Reads the signed-in user again from GitHub. A 401 signs out (`tokenRejected`); any other failure
         * (offline, GitHub down) keeps the session as it is.
         */
        async function refreshViewer() {
            const token = tokenRef.value;
            if (token === null) {
                return;
            }

            try {
                const viewer = await fetchViewer(token);
                storeViewer(token, viewer);
            } catch (error) {
                // Signed out or in again meanwhile, here or in another tab: this answer is about a session that
                // is gone, and signing it out would sign out the one that replaced it.
                if (!isCurrentToken(token)) {
                    return;
                }

                if (isTokenRejected(error)) {
                    logger.warn('GitHub rejected the stored token; signing out');
                    signOut('tokenRejected');
                } else {
                    logger.warn('Could not refresh the signed-in user', { error });
                }
            }
        }

        async function acceptToken(token: string, returnTo: string, signal?: AbortSignal): Promise<SignInResult> {
            let viewer: Viewer;
            try {
                viewer = await fetchViewer(token);
            } catch (error) {
                signal?.throwIfAborted();
                logger.warn('GitHub did not accept the new token', { error });
                return fail(isTokenRejected(error) ? 'tokenRejected' : 'failed');
            }

            signal?.throwIfAborted();
            vault.write(token);
            tokenRef.value = token;
            storeViewer(token, viewer);
            failureRef.value = null;
            return { ok: true, returnTo };
        }

        async function fetchViewer(token: string): Promise<Viewer> {
            const { viewer } = await createSdk(() => token).Viewer();
            return { login: viewer.login, name: viewer.name, avatarUrl: viewer.avatarUrl };
        }

        /**
         * Keeps the user GitHub said `token` belongs to — unless the session moved on while GitHub was answering,
         * here or in another tab, so a late answer never brings back a user who signed out.
         */
        function storeViewer(token: string, viewer: Viewer) {
            if (!isCurrentToken(token)) {
                return;
            }

            browser.localStorage.setItem(VIEWER_KEY, JSON.stringify(viewer));
            viewerRef.value = viewer;
        }

        /** Whether `token` is still the session's, in this tab and in the vault every tab shares. */
        function isCurrentToken(token: string) {
            return tokenRef.value === token && vault.read() === token;
        }

        /**
         * Another tab changed the stored token. Gone: it signed out, so this tab is signed out too (its storage is
         * already cleared, and nothing more goes to GitHub with the old token). Another one: it signed in as
         * someone, whom this tab takes over, checking with GitHub in the background.
         */
        function followStoredToken() {
            const stored = vault.read();
            if (stored === tokenRef.value) {
                return;
            }

            tokenRef.value = stored;
            failureRef.value = null;
            if (stored === null) {
                viewerRef.value = null;
                return;
            }

            // The other tab kept the user right after the token, so it is normally there already; until GitHub
            // answers, the user shown so far stays rather than flashing the landing page.
            viewerRef.value = readStoredViewer() ?? viewerRef.value;
            void refreshViewer();
        }

        function readStoredViewer(): Viewer | null {
            const stored = parseJson(browser.localStorage.getItem(VIEWER_KEY));
            if (
                !isPlainObject(stored) ||
                typeof stored.login !== 'string' ||
                typeof stored.avatarUrl !== 'string' ||
                !(typeof stored.name === 'string' || stored.name === null)
            ) {
                return null;
            }

            return { login: stored.login, name: stored.name, avatarUrl: stored.avatarUrl };
        }

        /** The kept sign-in, removed as it is read: a `state` is good for one return from GitHub. */
        function takePendingSignIn(): PendingSignIn | null {
            const stored = parseJson(browser.sessionStorage.getItem(PENDING_SIGN_IN_KEY));
            browser.sessionStorage.removeItem(PENDING_SIGN_IN_KEY);
            if (!isPlainObject(stored) || typeof stored.state !== 'string' || stored.state === '') {
                return null;
            }

            const returnTo = safeNextPath(typeof stored.returnTo === 'string' ? stored.returnTo : undefined) ?? '/';
            return { state: stored.state, returnTo };
        }

        async function exchangeCode(code: string): Promise<OAuthTokenExchangeResult | null> {
            let response: Response;
            let text: string;
            try {
                response = await browser.fetch(OAUTH_TOKEN_PATH, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, redirectUri: browser.origin + OAUTH_CALLBACK_PATH }),
                });
                // Read here too: a connection dropped while the answer arrives rejects the read.
                text = await response.text();
            } catch (error) {
                logger.warn('The token exchange could not be reached', { error });
                return null;
            }

            const body: unknown = parseJson(text);
            if (
                !response.ok ||
                !isPlainObject(body) ||
                typeof body.accessToken !== 'string' ||
                !Array.isArray(body.scopes)
            ) {
                const error = isPlainObject(body) && typeof body.error === 'string' ? body.error : undefined;
                logger.warn('The token exchange failed', { status: response.status, error });
                return null;
            }

            const scopes = body.scopes.filter(scope => typeof scope === 'string');
            return { accessToken: body.accessToken, scopes };
        }

        function fail(failure: SignInFailure): SignInResult {
            failureRef.value = failure;
            return { ok: false, failure };
        }

        /** The hint cookie, set or cleared; `Secure` exactly when the app is served over https. */
        function signedInHintCookie(set: boolean) {
            const { name, value, maxAgeSeconds } = SIGNED_IN_HINT_COOKIE;
            const secure = browser.origin.startsWith('https:') ? '; Secure' : '';
            return `${name}=${set ? value : ''}; Path=/; SameSite=Lax; Max-Age=${set ? maxAgeSeconds : 0}${secure}`;
        }

        function createState() {
            const bytes = new Uint8Array(32);
            browser.getRandomValues(bytes);
            // base64url, 43 characters: what the Worker accepts as `state` (`OAUTH_STATE_PATTERN`).
            return btoa(String.fromCodePoint(...bytes))
                .replaceAll('+', '-')
                .replaceAll('/', '_')
                .replace(/=+$/, '');
        }
    },
});

function isTokenRejected(error: unknown) {
    return error instanceof GitHubApiError && error.status === 401;
}
