import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import {
    hasOAuthScopes,
    OAUTH_AUTHORIZE_PATH,
    OAUTH_CALLBACK_PATH,
    OAUTH_REFRESH_PATH,
    OAUTH_REVOKE_PATH,
    OAUTH_TOKEN_PATH,
    SIGNED_IN_HINT_COOKIE,
} from '@githq/github/oauth.js';
import type { OAuthCredentials, OAuthTokenExchangeResult } from '@githq/github/oauth.js';
import {
    USAGE_STATISTICS_FIELD,
    USAGE_STATISTICS_OFF_KEY,
    USAGE_STATISTICS_OFF_VALUE,
} from '@githq/github/usageStatistics.js';
import { parseJson } from '@githq/github/utils/parseJson.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { assert } from '@nzyme/utils/assert.js';
import { createSingleRunner } from '@nzyme/utils/createSingleRunner.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { shallowRef, watch } from 'vue';

import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import { GitHubSdkFactory } from '@/services/GitHubSdkFactory.js';

import { safeNextPath } from './routeAccess.js';
import { TokenVault } from './TokenVault.js';
import { readOAuthTokenAnswer } from './utils/readOAuthTokenAnswer.js';

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
 * - `tokenRejected`: GitHub stopped accepting the stored token (revoked, or expired with no refresh token), or refused
 *   to renew it (`bad_refresh_token`), so they were signed out.
 */
export type SignInFailure = 'cancelled' | 'failed' | 'missingScopes' | 'tokenRejected';

/** The query GitHub sends the browser back to `/auth/callback` with. */
export interface SignInCallbackParams {
    readonly code?: string;
    readonly state?: string;
    /** `access_denied` when the user cancelled. */
    readonly error?: string;
}

/** The parameters of `signInWithToken` beside the token: what GitHub issued with it, and the attempt's signal. */
export interface SignInWithTokenOptions {
    /** The token that renews it; none for a token that never expires (a pasted development token). */
    readonly refreshToken?: string | null;
    /** Seconds until the token expires, as GitHub said; none when it never does. */
    readonly expiresIn?: number | null;
    /** Aborted: the sign-in rejects with its reason and keeps nothing. */
    readonly signal?: AbortSignal;
}

/** What GitHub issued: a token, what renews it and when it expires. */
type TokenGrant = Pick<OAuthTokenExchangeResult, 'accessToken' | 'refreshToken' | 'expiresIn'>;

/** How a sign-in ended: where to go on, or why it failed (also kept in `failure`). */
export type SignInResult =
    | { readonly ok: true; readonly returnTo: string }
    | { readonly ok: false; readonly failure: SignInFailure };

/** The signed-in user, kept so a reload shows the shell at once; refreshed in the background. */
export const VIEWER_KEY = 'githq.viewer';
/** The sign-in under way (`sessionStorage`): its `state` and where to return, while the user is on GitHub. */
export const PENDING_SIGN_IN_KEY = 'githq.signIn';
/**
 * The last sign-outs on a token GitHub rejected ({@link TokenRejection}), oldest first, kept across sign-ins. Evidence
 * for why a session ended, to set against GitHub's security log.
 */
export const TOKEN_REJECTIONS_KEY = 'githq.tokenRejections';
/** How many {@link TOKEN_REJECTIONS_KEY} keeps. */
const MAX_TOKEN_REJECTIONS = 10;
/**
 * How long to wait before each further check of a token GitHub answered 401 for, when the session has no refresh token
 * (a pasted development token). GitHub has answered `Bad credentials` for a token it never revoked, right after the Mac
 * woke from sleep, so one 401 is not proof enough to forget a token the user would have to sign in again for: the
 * session ends only when every check is refused. With a refresh token, a 401 renews the token instead.
 */
const REJECTION_RECHECK_DELAYS_MS = [3_000, 15_000];
/** How long before the access token expires the timer renews it. */
const REFRESH_AHEAD_MS = 5 * 60_000;
/** How close to its expiry a request waits for the access token to be renewed before it goes. */
const REFRESH_BEFORE_REQUEST_MS = 2 * 60_000;
/** How long after a renewal that failed (the Worker or GitHub unreachable) the next one is tried. */
const REFRESH_RETRY_MS = 60_000;
/** The Web Lock under which a tab renews the token, so two tabs never spend the same refresh token. */
const REFRESH_LOCK = 'githq.tokenRefresh';

/** One sign-out on a token GitHub rejected, or whose refresh token it refused. */
export interface TokenRejection {
    /** When, as an ISO date. */
    readonly at: string;
    /**
     * The token's SHA-256, base64: what GitHub's security log shows as `hashed_token`, so the log says when the token
     * was issued and whether GitHub destroyed it. Never the token itself.
     */
    readonly tokenHash: string;
    /** GitHub's last answer to the token (401), or the Worker's to its refresh token (400). */
    readonly status: number;
    /**
     * GitHub's own words for the last refusal (`Bad credentials`), when it gave any; for a refused refresh token, the
     * Worker's error code (`bad_refresh_token`).
     */
    readonly githubMessage: string | null;
}

interface PendingSignIn {
    state: string;
    returnTo: string;
}

/**
 * The GitHub session: the OAuth credentials and who they belong to, signing in through GitHub's web flow (D1) and
 * signing out.
 *
 * The credentials are kept in the {@link TokenVault} and the user in `localStorage`, so a reload opens the shell
 * straight away; the user is then read again from GitHub in the background, and a token GitHub keeps rejecting (401)
 * signs the user out with `failure: 'tokenRejected'`. No token is ever logged.
 *
 * GitHub's access tokens expire after 8 hours; the refresh token renews them through the Worker
 * ({@link OAUTH_REFRESH_PATH}): 5 minutes ahead on a timer, before a request when the token is about to expire (after
 * the Mac slept, say), and on a 401. One renewal runs at a time in a tab, under a Web Lock across tabs: a tab that
 * finds the token renewed by another takes it over rather than spending the refresh token again. A refresh token the
 * Worker refuses signs out (`tokenRejected`); a Worker it cannot reach keeps the session and tries again a minute later.
 *
 * While a token is stored, the `githq_signed_in` cookie ({@link SIGNED_IN_HINT_COOKIE}) is set, so the Worker serves
 * the app rather than the landing page at `/`; it is cleared with the token. It carries no token and no identity.
 *
 * Every tab of the app shares the session: signing out in one signs out the others, and signing in as someone
 * else in one moves the others to that user.
 *
 * Signing out also revokes the token at GitHub, through the Worker ({@link OAUTH_REVOKE_PATH}): GitHub keeps ten tokens
 * per user and OAuth App, and past that every new sign-in — on the web or in the desktop app — revokes another one,
 * which signed the other device out.
 */
export type AuthStore = Resolved<typeof AuthStore>;
export const AuthStore = defineService({
    name: 'AuthStore',
    deps: {
        browser: Browser,
        clock: Clock,
        createSdk: GitHubSdkFactory,
        logger: Logger,
        vault: TokenVault,
    },
    setup({ browser, clock, createSdk, logger, vault }) {
        const credentialsRef = shallowRef<OAuthCredentials | null>(vault.read());
        const viewerRef = shallowRef<Viewer | null>(credentialsRef.value === null ? null : readStoredViewer());
        const failureRef = shallowRef<SignInFailure | null>(null);
        /**
         * The check of a token under way, which every other refresh of the same token joins: each sync loop asks for
         * one when it gets a 401.
         */
        let refreshing: { token: string; done: Promise<void> } | null = null;
        /** The one renewal of the access token running in this tab, which every trigger joins. */
        const renewal = createSingleRunner({ handler: renewToken });
        /** Cancels the timer of the next renewal. */
        let cancelRenewalTimer: (() => void) | null = null;
        /** Until when a request does not try a renewal again, after one failed (epoch ms). */
        let renewalRetryAt = 0;

        // With a known user the shell opens at once and the check runs behind it; without one, the route guard
        // waits for it.
        const ready = credentialsRef.value !== null && viewerRef.value === null ? refreshViewer() : Promise.resolve();
        if (credentialsRef.value !== null && viewerRef.value !== null) {
            void refreshViewer();
        }

        // Follows the credentials, not `signedIn`: the cookie must not blink while a stored token's user is fetched.
        // Every change of the credentials goes through `credentialsRef`, so this is the only place that writes the
        // cookie.
        watch(
            () => credentialsRef.value !== null,
            stored => browser.writeCookie(signedInHintCookie(stored)),
            { immediate: true, flush: 'sync' },
        );
        // A renewal is due ahead of each expiry; new credentials, or none, replace the timer of the earlier ones.
        watch(credentialsRef, scheduleRenewal, { immediate: true, flush: 'sync' });

        vault.onChange(followStoredToken);

        return {
            /** Whether a user is signed in; reactive. */
            get signedIn() {
                return credentialsRef.value !== null && viewerRef.value !== null;
            },
            /** The signed-in user, or `null`; reactive. */
            get viewer() {
                return viewerRef.value;
            },
            /** The OAuth access token for GitHub's API, or `null` signed out; reactive. */
            get token() {
                return credentialsRef.value?.accessToken ?? null;
            },
            /** Why the last sign-in failed or the session ended, for the landing page's banner; reactive. */
            get failure() {
                return failureRef.value;
            },
            /** Resolves once the stored session is known to belong to a user (or is gone). */
            ready: () => ready,
            getFreshToken,
            startSignIn,
            completeSignIn,
            signInWithToken,
            signOut,
            dismissFailure,
            refreshViewer,
        };

        /**
         * The token to send a request with now: renewed first when it is about to expire. A renewal that fails still
         * answers the token held, so the request goes and a 401 takes over. Rejects signed out: an account's requests
         * ask only while it is signed in (`AccountSession`).
         */
        async function getFreshToken(): Promise<string> {
            const credentials = credentialsRef.value;
            if (credentials === null) {
                throw new Error('Signed out');
            }

            if (
                credentials.refreshToken !== null &&
                credentials.expiresAt !== null &&
                credentials.expiresAt - clock.now() <= REFRESH_BEFORE_REQUEST_MS &&
                clock.now() >= renewalRetryAt
            ) {
                await renewal.execute();
            }

            // Signed out meanwhile (a refused refresh token): the request goes for nobody, its account no longer current.
            return credentialsRef.value?.accessToken ?? credentials.accessToken;
        }

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

            return await acceptToken(receiveCredentials(exchanged), pending.returnTo);
        }

        /**
         * Signs in with a token from elsewhere — the development sign-in's pasted one (`DevTokenForm`, which never
         * expires), or the one the desktop app's device sign-in got (`DeviceSignIn`, with its refresh token and
         * expiry). Kept once GitHub has said whose it is, unless `signal` aborted meanwhile: then it rejects with the
         * abort reason and keeps nothing.
         */
        async function signInWithToken(token: string, options: SignInWithTokenOptions = {}): Promise<SignInResult> {
            const credentials = receiveCredentials({
                accessToken: token,
                refreshToken: options.refreshToken ?? null,
                expiresIn: options.expiresIn ?? null,
            });
            return await acceptToken(credentials, '/', options.signal);
        }

        /**
         * Forgets the token and the user. With a `failure`, the landing page explains it. Without one — the user signed
         * out — the token is revoked at GitHub too, behind the sign-out: a rejected token is gone already.
         */
        function signOut(failure: SignInFailure | null = null) {
            const credentials = credentialsRef.value;
            if (credentials !== null && failure === null) {
                void revokeToken(credentials.accessToken);
            }

            vault.remove();
            browser.localStorage.removeItem(VIEWER_KEY);
            credentialsRef.value = null;
            viewerRef.value = null;
            failureRef.value = failure;
        }

        /** The user dismissed the explanation of `failure`: the route guard no longer brings it back. */
        function dismissFailure() {
            failureRef.value = null;
        }

        /**
         * Reads the signed-in user again from GitHub. A 401 renews the token when the session has a refresh token;
         * without one it is checked again a few times ({@link REJECTION_RECHECK_DELAYS_MS}), and only a token refused
         * every time signs out (`tokenRejected`). Any other answer (offline, GitHub down) keeps the session as it is.
         */
        async function refreshViewer() {
            const token = credentialsRef.value?.accessToken ?? null;
            if (token === null) {
                return;
            }

            if (refreshing?.token !== token) {
                const check = { token, done: checkToken(token) };
                refreshing = check;
                void check.done.finally(() => {
                    if (refreshing === check) {
                        refreshing = null;
                    }
                });
            }

            await refreshing.done;
        }

        async function checkToken(token: string) {
            let rejection: GitHubApiError | null = null;
            for (const delayMs of [0, ...REJECTION_RECHECK_DELAYS_MS]) {
                if (delayMs > 0) {
                    await new Promise<void>(resolve => {
                        clock.schedule(resolve, delayMs);
                    });
                }

                // Signed out or in again meanwhile, here or in another tab: this answer is about a session that is
                // gone, and signing it out would sign out the one that replaced it.
                if (!isCurrentToken(token)) {
                    return;
                }

                try {
                    const viewer = await fetchViewer(token);
                    storeViewer(token, viewer);
                    return;
                } catch (error) {
                    if (!isCurrentToken(token)) {
                        return;
                    }

                    if (!isTokenRejected(error)) {
                        logger.warn('Could not refresh the signed-in user', { error });
                        return;
                    }

                    logger.warn('GitHub rejected the stored token', { githubMessage: error.githubMessage });
                    rejection = error;
                }

                if (credentialsRef.value?.refreshToken != null) {
                    await renewAfterRejection(token);
                    return;
                }
            }

            assert(rejection);
            // Kept before the session ends, so nothing that follows the sign-out can lose it.
            await recordRejection(token, { status: rejection.status, githubMessage: rejection.githubMessage ?? null });
            if (isCurrentToken(token)) {
                logger.warn('GitHub kept rejecting the stored token; signing out');
                signOut('tokenRejected');
            }
        }

        /**
         * A 401 for a token the session can renew: renewed, the session goes on with the new token, whose user is read
         * again; refused, it is signed out already; not reached, it is kept and the timer tries again.
         */
        async function renewAfterRejection(token: string) {
            await renewal.execute();
            const renewed = credentialsRef.value;
            if (renewed === null || renewed.accessToken === token) {
                return;
            }

            try {
                storeViewer(renewed.accessToken, await fetchViewer(renewed.accessToken));
            } catch (error) {
                logger.warn('Could not refresh the signed-in user after renewing the token', { error });
            }
        }

        /** Keeps the evidence of a rejection under {@link TOKEN_REJECTIONS_KEY}, dropping the oldest past the limit. */
        async function recordRejection(token: string, refusal: Pick<TokenRejection, 'status' | 'githubMessage'>) {
            let tokenHash: string;
            try {
                const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
                tokenHash = btoa(String.fromCodePoint(...new Uint8Array(digest)));
            } catch (hashError) {
                logger.warn('Could not hash the rejected token', { error: hashError });
                tokenHash = '';
            }

            const rejection: TokenRejection = {
                at: new Date(clock.now()).toISOString(),
                tokenHash,
                status: refusal.status,
                githubMessage: refusal.githubMessage,
            };
            const stored = parseJson(browser.localStorage.getItem(TOKEN_REJECTIONS_KEY));
            const earlier = Array.isArray(stored) ? stored : [];
            browser.localStorage.setItem(
                TOKEN_REJECTIONS_KEY,
                JSON.stringify([...earlier, rejection].slice(-MAX_TOKEN_REJECTIONS)),
            );
        }

        async function acceptToken(
            credentials: OAuthCredentials,
            returnTo: string,
            signal?: AbortSignal,
        ): Promise<SignInResult> {
            let viewer: Viewer;
            try {
                viewer = await fetchViewer(credentials.accessToken);
            } catch (error) {
                signal?.throwIfAborted();
                logger.warn('GitHub did not accept the new token', { error });
                return fail(isTokenRejected(error) ? 'tokenRejected' : 'failed');
            }

            signal?.throwIfAborted();
            vault.write(credentials);
            credentialsRef.value = credentials;
            storeViewer(credentials.accessToken, viewer);
            failureRef.value = null;
            return { ok: true, returnTo };
        }

        /** The credentials of a token GitHub just issued: its expiry counted from now. */
        function receiveCredentials(grant: TokenGrant): OAuthCredentials {
            return {
                accessToken: grant.accessToken,
                refreshToken: grant.refreshToken,
                expiresAt: grant.expiresIn === null ? null : clock.now() + grant.expiresIn * 1000,
            };
        }

        /** Sets the timer of the next renewal of `credentials`: {@link REFRESH_AHEAD_MS} before they expire. */
        function scheduleRenewal(credentials: OAuthCredentials | null) {
            renewalRetryAt = 0;
            if (credentials?.refreshToken == null || credentials.expiresAt === null) {
                setRenewalTimer(null);
                return;
            }

            setRenewalTimer(Math.max(0, credentials.expiresAt - REFRESH_AHEAD_MS - clock.now()));
        }

        /** Replaces the timer of the next renewal with one `delayMs` from now, or with none. */
        function setRenewalTimer(delayMs: number | null) {
            cancelRenewalTimer?.();
            cancelRenewalTimer = null;
            if (delayMs !== null) {
                cancelRenewalTimer = clock.schedule(() => {
                    cancelRenewalTimer = null;
                    void renewal.execute();
                }, delayMs);
            }
        }

        /**
         * Renews the access token of the session held now, under {@link REFRESH_LOCK}. Never throws: what went wrong is
         * logged, and the session goes on with the token it has.
         */
        async function renewToken() {
            const started = credentialsRef.value;
            if (started?.refreshToken == null) {
                return;
            }

            const release = await acquireRenewalLock();
            try {
                await renewTokenLocked(started.accessToken, started.refreshToken);
            } catch (error) {
                logger.warn('Could not renew the token', { error });
                retryRenewal(started.accessToken);
            } finally {
                release();
            }
        }

        async function renewTokenLocked(token: string, refreshToken: string) {
            // Signed out, or in as someone else, while waiting for the lock: nothing of this session to renew.
            if (credentialsRef.value?.accessToken !== token) {
                return;
            }

            // Another tab renewed the token while this one waited — the refresh token is spent — or signed out:
            // what it stored is the session now.
            if (vault.read()?.accessToken !== token) {
                followStoredToken();
                return;
            }

            let response: Response;
            let text: string;
            try {
                response = await browser.fetch(__WORKER_ORIGIN__ + OAUTH_REFRESH_PATH, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken }),
                });
                text = await response.text();
            } catch (error) {
                logger.warn('The token renewal could not be reached', { error });
                retryRenewal(token);
                return;
            }

            const body: unknown = parseJson(text);
            const errorCode = isPlainObject(body) && typeof body.error === 'string' ? body.error : null;
            const answer = response.ok ? readOAuthTokenAnswer(body) : null;
            if (answer) {
                // A late answer never brings back a session signed out or replaced meanwhile.
                if (!isCurrentToken(token)) {
                    return;
                }

                const renewed = receiveCredentials(answer);
                vault.write(renewed);
                credentialsRef.value = renewed;
                logger.info('Renewed the token');
                return;
            }

            if (response.status === 400 && errorCode === 'bad_refresh_token') {
                if (!isCurrentToken(token)) {
                    return;
                }

                logger.warn('GitHub refused the refresh token; signing out');
                await recordRejection(token, { status: response.status, githubMessage: errorCode });
                if (isCurrentToken(token)) {
                    signOut('tokenRejected');
                }

                return;
            }

            logger.warn('The token renewal failed', { status: response.status, error: errorCode });
            retryRenewal(token);
        }

        /** A renewal of `token` failed: the timer tries again in a while, and requests go on with the token meanwhile. */
        function retryRenewal(token: string) {
            if (credentialsRef.value?.accessToken !== token) {
                return;
            }

            renewalRetryAt = clock.now() + REFRESH_RETRY_MS;
            setRenewalTimer(REFRESH_RETRY_MS);
        }

        /** Waits for {@link REFRESH_LOCK}; the function returned releases it. Without Web Locks, nothing to wait for. */
        function acquireRenewalLock(): Promise<() => void> {
            return new Promise(resolve => {
                let release: (() => void) | null = null;
                release = browser.requestLock(REFRESH_LOCK, () => {
                    resolve(() => release?.());
                });
                if (release === null) {
                    resolve(() => {});
                }
            });
        }

        /**
         * Asks the Worker to revoke `token` at GitHub. Nothing waits for it, and a failure — offline, the Worker down —
         * only leaves the token to GitHub's own limits. `__WORKER_ORIGIN__`: the desktop app's webview is not on
         * githq.dev.
         */
        async function revokeToken(token: string) {
            try {
                const response = await browser.fetch(__WORKER_ORIGIN__ + OAUTH_REVOKE_PATH, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(withUsageStatisticsChoice({ token })),
                });
                if (!response.ok) {
                    logger.warn('The Worker could not revoke the token', { status: response.status });
                }
            } catch (error) {
                logger.warn('The token revocation could not be reached', { error });
            }
        }

        /** Marks an OAuth request's body for the Worker not to count when this device has usage statistics off. */
        function withUsageStatisticsChoice(body: Record<string, string>): Record<string, string | boolean> {
            return browser.localStorage.getItem(USAGE_STATISTICS_OFF_KEY) === USAGE_STATISTICS_OFF_VALUE
                ? { ...body, [USAGE_STATISTICS_FIELD]: false }
                : body;
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

        /** Whether `token` is still the session's access token, in this tab and in the vault every tab shares. */
        function isCurrentToken(token: string) {
            return credentialsRef.value?.accessToken === token && vault.read()?.accessToken === token;
        }

        /**
         * Another tab changed the stored credentials. Gone: it signed out, so this tab is signed out too (its storage
         * is already cleared, and nothing more goes to GitHub with the old token). Others: it renewed the token, or
         * signed in as someone, whom this tab takes over, checking with GitHub in the background.
         */
        function followStoredToken() {
            const stored = vault.read();
            if (stored?.accessToken === credentialsRef.value?.accessToken) {
                return;
            }

            credentialsRef.value = stored;
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
                    body: JSON.stringify(
                        withUsageStatisticsChoice({ code, redirectUri: browser.origin + OAUTH_CALLBACK_PATH }),
                    ),
                });
                // Read here too: a connection dropped while the answer arrives rejects the read.
                text = await response.text();
            } catch (error) {
                logger.warn('The token exchange could not be reached', { error });
                return null;
            }

            const body: unknown = parseJson(text);
            const answer = response.ok ? readOAuthTokenAnswer(body) : null;
            if (!answer) {
                const error = isPlainObject(body) && typeof body.error === 'string' ? body.error : undefined;
                logger.warn('The token exchange failed', { status: response.status, error });
            }

            return answer;
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
                .replace(/[=]+$/, '');
        }
    },
});

function isTokenRejected(error: unknown): error is GitHubApiError {
    return error instanceof GitHubApiError && error.status === 401;
}
